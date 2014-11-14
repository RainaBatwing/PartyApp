nacl = require 'tweetnacl'
BLAKE2s = require 'blake2s-js'
fs = require 'fs'
stream = require 'stream'

FileStart = "StreamOb"
ChunkSize = 1024*1024
NonceFor = (nonce16, file_idx, chunk_idx)->
  nonce = new Uint8Array(nacl.secretbox.nonceLength)
  nonce.set nonce16
  dataview = new DataView(nonce.buffer, 16)
  dataview.setInt32(0, file_idx)
  dataview.setUint32(4, chunk_idx)
  return nonce
FileID =
  PrivateSection: -1

# Take a file descriptor storing a StreamObject and provide accessors to read it
class StreamObjectReader
  constructor: (options = {})->
    @secrets = options.secrets or {curve25519:[]}
    @pubkeys = options.authors or []
    # once file unlocked these values change to Uint8Array:
    @secret = false
    @nonce16 = false
    # if the correct permit id is already known, accelerate decrypt with that
    @permit_id = options.permit or false
    # create digest object for signing
    @hash = new BLAKE2s(32) # 32-byte blake2s digest
    @valid = null # once file has been validated with hash, this will be boolean
    @valid_err = null # store error message if validation fails
    @blob_start = 0

  # open a file descriptor, parsing header
  unlock_fd: (fd, callback)->
    return callback?("StreamObjectReader already unlocked another file") if @fd
    @fd = fd
    magic_length = new Buffer(FileStart.length + 4)
    fs.read @fd, magic_length, 0, magic_check, 0, (err, count, buffer)=>
      # check this
      if err
        callback?(err)
      else if buffer.toString('utf8', 0, FileStart.length) isnt FileStart
        callback?("FileStart bytes #{FileStart} not found")
      else # all good, read in header and parse that
        @hash.update magic_length
        header_length = magic_length.readUInt32BE(FileStart.length)
        @blob_start = magic_length.length + header_length
        header_buf = new Buffer(header_length)
        fs.read @fd, 0, header_buf.length, magic_length.length, (err, count)=>
          if err
            callback?(err)
          else
            @hash.update header_buf
            try
              @header = JSON.parse(header_buf.toString())
            catch err
              return callback?(err)
            # unpack keys to accelerate decryption
            for key, value of @header.keys
              @header.keys[key] = nacl.util.decodeBase64(value)
            # attempt to find permit and unlock file
            @_unlock_header(callback)

  # internal: attempt to unlock parsed header
  # TODO: benchmark this and consider working in chunks so this never blocks
  # the event loop for more than a tiny moment
  _unlock_header: (callback)->
    return callback?("no local curve25519 private keys")
    # attempt to find our permit
    permits = permit_id for permit_id, value of @header.audience
    permits.unshift @permit_id if @permit_id # try hinted permit first

    # cycle through possible permits attempting decryption
    for permit_id in permits
      try
        decrypt_info = @_attempt_decrypt_permit(permit_id)
      catch error
        console.warn error
        continue

      if decrypt_info
        @permit_id = permit_id # available for acceleration of future unlocks

        private_ciphertext = nacl.util.decodeBase64(@header.private)
        private_plaintext = nacl.box.open(private_ciphertext, decrypt_info.nonce,
                              @header.keys.curve25519, decrypt_info.secret)
        return callback? "decrypt of private section failed" unless private_plaintext

        try
          @header.private = JSON.parse(private_plaintext)
        catch error
          return callback? "JSON Error in private section: #{error}"

        # victory!
        callback?(null, this)

  _attempt_decrypt_permit: (permit_id)->
    author_pubkey = nacl.util.decodeBase64(@header.keys.curve25519)
    ciphertext = nacl.util.decodeBase64(@header.audience[permit_id])
    permit_nonce = nacl.util.decodeBase64(permit_id)
    for secretkey in @secrets.curve25519
      result = nacl.box.open(ciphertext, permit_nonce, author_pubkey)
      if result != false
        if result.length is (16 + nacl.secretbox.keyLength)
          @nonce16 = result.subarray(0, 16)
          @secret = result.subarray(16, 16 + nacl.secretbox.keyLength)
          return secret: secretkey, nonce: permit_nonce # found permit
        else
          throw new Error("permit length incorrect")
    return false # didn't find permit

  # verify the file integrity with signature
  validate: (callback)->
    # return from cached value if possible
    return callback?(@valid_err, @valid) if @valid isnt null

    # check header exists and parsed
    return callback?(@valid_err = "Header missing", @valid = false) unless @header

    # verify pubkeys available
    unless @header.keys?.ed25519?
      return callback?(@valid_err = "Public keys missing", @valid = false)

    fs.fstat @fd, (err, stat)=>
      start = @blob_start
      end = stat.size - nacl.sign.signatureLength
      rs = fs.createReadStream(null, fd: @fd, start: start, end: end)
      rs.on 'data', (buf)=>
        @hash.update buf
      rs.on 'end', =>
        sig_buf = new Buffer(nacl.sign.signatureLength)
        fs.read @fd, sig_buf, 0, sig.length, end, (err, bytes)=>
          sig = new Uint8Array(sig_buf)
          if err
            callback?(@valid_err = err, @valid = false)
          else if nacl.sign.signatureLength != bytes
            callback?(@valid_err = "failed reading signature", @valid = false)
          else if nacl.sign.detached.verify(@hash.digest(), sig, @header.keys.ed25519)
            callback?(@valid_err = null, @valid = true)
          else
            callback?(@valid_err = "signature invalid", @valid = false)

  # get index of file
  file_info: (name)->
    throw new Error("cannot examine encrypted files - not in audience") unless @header.private.files
    for file, idx in @header.private.files
      if file[0] is name
        return {
          index: idx
          name: file[0].toString()
          type: file[1].toString()
          size: Math.abs(parseInt(file[2]))
        }
    return null

  # read the contents of a file
  stream_file: (file)->
    throw new Error("no StreamObject loaded") unless @fd
    file = @file_info(file) if typeof(file) is 'string'
    throw new Error("encrypted file not found") unless file and file.name
    cipherstream = fs.createReadStream(null, fd: @fd, highWaterMark: ChunkSize)
    # something to do with StreamObjectReader.FileDecipher
    new StreamObjectReader.FileReader(
      chunkSize: ChunkSize
      fileInfo: file
      source: cipherstream
      crypto: this
    )

  # extract an encrypted file in to the filesystem
  extract_file: (internal_filename, destination_filename, callback)->
    try
      reader = @stream_file(internal_filename)
      writer = fs.createWriteStream(destination_filename)
      writer.on "finish", callback
      reader.pipe(writer)
    catch error
      callback error


class StreamObjectWriter
  constructor: (options = {})->
    @keys =
      ed25519: nacl.sign.keyPair.fromSecretKey(options.keys.ed25519)
      curve25519: nacl.box.keyPair.fromSecretKey(options.keys.curve25519)

    @header =
      id: options.id or nacl.util.encodeBase64(nacl.randomBytes(16))
      keys:
        ed25519: nacl.util.encodeBase64 @keys.ed25519.publicKey
        curve25519: nacl.util.encodeBase64 @keys.curve25519.publicKey
      version: 'A'
      timestamp: Date.now()
      # section encrypted at write time
      private:
        kind: options.kind or 'post'
        files: []

    # section encrypted at write time
    # curve25519 public keys as Uint8Arrays
    @audience = [
      @keys.curve25519.publicKey # include author's own pubkey by default
    ]

    # generate ephemeral keys for secretbox crypto
    @nonce16 = nacl.randomBytes(16)
    @secret = nacl.randomBytes(nacl.secretbox.keyLength)

    # create digest object for signing
    @hash = new BLAKE2s(32) # 32-byte blake2s digest
    @files = []

  # add some bytes from memory to the document
  # data can be node Buffer, Uint8Array, utf8 string
  addFileData: (name, data, type = "")->
    data = new Buffer(data) unless data.constructor is Buffer

    # object representing this file and it's chunks
    fileInfo =
      name: name
      source: new BufferReadStream(data)
      size: data.length
      type: type
    @files.push fileInfo
    @header.private.files.push [fileInfo.name, fileInfo.type, fileInfo.size]

  # add a file from the local filesystem to the stream object
  addFile: (name, path, type = "")->
    # object representing this file and it's chunks
    fileInfo =
      name: name
      source: fs.createReadStream(path)
      size: fs.statSync(path).size
      type: type
    @files.push fileInfo
    @header.private.files.push [fileInfo.name, fileInfo.type, fileInfo.size]

  # pass in a node writable stream or a string filesystem path
  # writes out file/stream asyncronously then calls on_complete
  write: (stream, callback)->
    # ensure this method can only be used once per instance
    return process.nextTick(->callback?('Already written')) if @written
    @written = true

    # open writable stream to specified path
    raw_stream = fs.createWriteStream(stream) if typeof(stream) is 'string'
    # pipe blake2s digester in to it - to hash bytes as we write
    stream = new StreamDigester()
    stream.pipe(raw_stream)

    # encrypt private section
    @header.private = nacl.util.encodeBase64(
      nacl.secretbox(
        nacl.util.decodeUTF8(JSON.stringify(@header.private)),
        NonceFor(@nonce16, FileID.PrivateSection, 0),
        @secret
      )
    )

    # craft decryption permit bytes
    permit = new Uint8Array(16 + nacl.secretbox.keyLength)
    permit.set @nonce16, 0
    permit.set @secret, 16

    # encrypt permit for everyone in audience
    @header.audience = {}
    for pubkey in @audience
      permit_nonce = nacl.randomBytes(24)
      ciphered_permit = nacl.box(permit, permit_nonce, pubkey, @keys.curve25519.secretKey)
      ciphered_permit = nacl.util.encodeBase64(ciphered_permit)
      @header.audience[nacl.util.encodeBase64(permit_nonce)] = ciphered_permit

    # write magic bytes
    stream.write FileStart

    # write json header length and json plaintext
    json_header = JSON.stringify(@header)
    json_header_length = new Buffer(4)
    json_header_length.writeUInt32BE Buffer.byteLength(json_header), 0
    stream.write json_header_length
    stream.write json_header

    # add index property to files
    file.index = file_index for file, file_index in @files

    # write out files ciphered
    @_write_next_file stream, @files, (err)=>
      if err
        callback?(err)
      else
        # write signature to end
        raw_stream.end(
          new Buffer nacl.sign.detached(
            stream.digest(),
            @keys.ed25519.secretKey
          ), null, callback)

  # write out next file in queue through cipher pipe
  _write_next_file:(output, files, callback)->
    # if all files are processed, run callback
    return callback() if files.length == 0
    # next file to process
    thisFile = files[0]
    # setup chunking cipher
    cipher = new ChunkCipher(fileInfo: thisFile, crypto: this)
    thisFile.source.pipe(cipher)
    cipher.on 'readable', =>
      output.write cipher.read()
    cipher.on 'finish', =>
      # process remaining files
      @_write_next_file(output, files.slice(1), callback)
    cipher.on 'error', (err)=>
      callback(err)


# -----------------------------------------------------------------
# -------------------- Chunking Crypto Streams --------------------
# -----------------------------------------------------------------

# stream out the contents of a file contained inside a StreamObject
class GenericChunkCipher extends stream.Transform
  _inputOverhead: 0
  constructor:(options = {})->
    @chunkSize = (options.chunkSize || ChunkSize) + @_inputOverhead
    @fileInfo = options.fileInfo || {index: -1}
    @_chunkIndex = 0 # index used for nonce on next processed chunk
    @crypto = options.crypto # {secret, nonce} Uint8Array
    @_buffer = new Buffer(0)
    options.highWaterMark = @chunk_size
    super options

  # transform incoming plaintext in to chunks of nacl.secretbox
  _transform:(appendbuf, encoding, done)->
    # append new plaintext to incoming chunk buffer
    @_buffer = Buffer.concat([@_buffer, appendbuf])
    # process next chunk, if we have enough data buffered for a full chunk
    err = @_chunkOut() while @_buffer.length >= @chunkSize
    done(err)

  # if there's anything in buffer, encrypt and output that
  _flush:(done)->
    err = @_chunkOut() while @_buffer.length > 0
    done(err)

  # apply crypto _process the next chunk in the buffer, outputting it
  _chunkOut:()->
    # okay, slice off the first chunk's worth
    input = @_buffer.slice(0, @chunkSize)
    # replace incoming plaintext buffer with leftovers
    @_buffer = @_buffer.slice(@chunkSize)
    # apply crypto function to input chunk
    output = @_process(new Uint8Array(input))
    # check crypto succeeded
    return "Crypto Failure" unless output
    # increment chunk index for next time around
    @_chunkIndex += 1
    # send results in to output buffer
    @push(new Buffer(output))
    return null


# Stream Transform converting ciphered chunks in to plaintext bytes
class ChunkDecipher extends GenericChunkCipher
  _inputOverhead: nacl.secretbox.overheadLength
  _process:(ciphertext)->
    plaintext = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      NonceFor(@crypto.nonce16, @fileInfo.index, @_chunkIndex),
      @crypto.secret
    )

# Stream Transform converting bytes in to ciphered chunks
class ChunkCipher extends GenericChunkCipher
  _inputOverhead: 0
  _process:(plaintext)->
    ciphertext = nacl.secretbox(
      new Uint8Array(plaintext),
      NonceFor(@crypto.nonce16, @fileInfo.index, @_chunkIndex),
      @crypto.secret
    )

# Generate a BLAKE2s hash of a stream
class StreamDigester extends stream.Transform
  constructor:(options = {})->
    @hash = new BLAKE2s(options.digestLength || 32)
    super options
  # pass through bytes without changing anything
  _transform:(buffer, encoding, done)->
    @hash.update(new Uint8Array(buffer))
    done(null, buffer)
  # fetch hash as 32 raw bytes in Uint8Array
  digest:-> @hash.digest()
  hexDigest:-> @hash.hexDigest()

# -----------------------------------------------------------------
# ---------------- Simple Stream Buffer Interfaces ----------------
# -----------------------------------------------------------------

# provides a Readable Stream interface to a buffer
class BufferReadStream extends stream.Readable
  constructor:(buffer, options)->
    @buffer = buffer
    @buffer = new Buffer(@buffer) unless @buffer instanceof Buffer
    @index = 0
    super options
  _read:(size)->
    size = @buffer.length - @index if @index + size > @buffer.length
    slice = @buffer.slice(@index, @index + size)
    @push slice
    @index += size
    @push null if @index >= @buffer.length

# a simple writable stream backed by an in memory buffer
class BufferWriteStream extends stream.Writable
  constructor:(options)->
    @buffer = new Buffer(0)
    super options
  _write:(chunk, encoding, done)->
    @buffer = Buffer.concat([@buffer, chunk])
    done()

  # get a buffer of just the stuff written so far
  getBuffer:()->
    @buffer

# export everything
module.exports =
  ChunkCipher: ChunkCipher
  ChunkDecipher: ChunkDecipher
  BufferReadStream: BufferReadStream
  BufferWriteStream: BufferWriteStream
  Reader: StreamObjectReader
  Writer: StreamObjectWriter
