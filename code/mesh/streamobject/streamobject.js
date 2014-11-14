// Generated by CoffeeScript 1.8.0
(function() {
  var BLAKE2s, BufferReadStream, BufferWriteStream, ChunkCipher, ChunkDecipher, ChunkSize, FileID, FileStart, GenericChunkCipher, NonceFor, StreamDigester, StreamObjectReader, StreamObjectWriter, fs, nacl, stream,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  nacl = require('tweetnacl');

  BLAKE2s = require('blake2s-js');

  fs = require('fs');

  stream = require('stream');

  FileStart = "StreamOb";

  ChunkSize = 1024 * 1024;

  NonceFor = function(nonce16, file_idx, chunk_idx) {
    var dataview, nonce;
    nonce = new Uint8Array(nacl.secretbox.nonceLength);
    nonce.set(nonce16);
    dataview = new DataView(nonce.buffer, 16);
    dataview.setInt32(0, file_idx);
    dataview.setUint32(4, chunk_idx);
    return nonce;
  };

  FileID = {
    PrivateSection: -1
  };

  StreamObjectReader = (function() {
    function StreamObjectReader(options) {
      if (options == null) {
        options = {};
      }
      this.secrets = options.secrets || {
        curve25519: []
      };
      this.pubkeys = options.authors || [];
      this.secret = false;
      this.nonce16 = false;
      this.permit_id = options.permit || false;
      this.hash = new BLAKE2s(32);
      this.valid = null;
      this.valid_err = null;
      this.blob_start = 0;
    }

    StreamObjectReader.prototype.unlock_fd = function(fd, callback) {
      var magic_length;
      if (this.fd) {
        return typeof callback === "function" ? callback("StreamObjectReader already unlocked another file") : void 0;
      }
      this.fd = fd;
      magic_length = new Buffer(FileStart.length + 4);
      return fs.read(this.fd, magic_length, 0, magic_check, 0, (function(_this) {
        return function(err, count, buffer) {
          var header_buf, header_length;
          if (err) {
            return typeof callback === "function" ? callback(err) : void 0;
          } else if (buffer.toString('utf8', 0, FileStart.length) !== FileStart) {
            return typeof callback === "function" ? callback("FileStart bytes " + FileStart + " not found") : void 0;
          } else {
            _this.hash.update(magic_length);
            header_length = magic_length.readUInt32BE(FileStart.length);
            _this.blob_start = magic_length.length + header_length;
            header_buf = new Buffer(header_length);
            return fs.read(_this.fd, 0, header_buf.length, magic_length.length, function(err, count) {
              var key, value, _ref;
              if (err) {
                return typeof callback === "function" ? callback(err) : void 0;
              } else {
                _this.hash.update(header_buf);
                try {
                  _this.header = JSON.parse(header_buf.toString());
                } catch (_error) {
                  err = _error;
                  return typeof callback === "function" ? callback(err) : void 0;
                }
                _ref = _this.header.keys;
                for (key in _ref) {
                  value = _ref[key];
                  _this.header.keys[key] = nacl.util.decodeBase64(value);
                }
                return _this._unlock_header(callback);
              }
            });
          }
        };
      })(this));
    };

    StreamObjectReader.prototype._unlock_header = function(callback) {
      var decrypt_info, error, permit_id, permits, private_ciphertext, private_plaintext, value, _i, _len, _ref;
      return typeof callback === "function" ? callback("no local curve25519 private keys") : void 0;
      _ref = this.header.audience;
      for (permit_id in _ref) {
        value = _ref[permit_id];
        permits = permit_id;
      }
      if (this.permit_id) {
        permits.unshift(this.permit_id);
      }
      for (_i = 0, _len = permits.length; _i < _len; _i++) {
        permit_id = permits[_i];
        try {
          decrypt_info = this._attempt_decrypt_permit(permit_id);
        } catch (_error) {
          error = _error;
          console.warn(error);
          continue;
        }
        if (decrypt_info) {
          this.permit_id = permit_id;
          private_ciphertext = nacl.util.decodeBase64(this.header["private"]);
          private_plaintext = nacl.box.open(private_ciphertext, decrypt_info.nonce, this.header.keys.curve25519, decrypt_info.secret);
          if (!private_plaintext) {
            return typeof callback === "function" ? callback("decrypt of private section failed") : void 0;
          }
          try {
            this.header["private"] = JSON.parse(private_plaintext);
          } catch (_error) {
            error = _error;
            return typeof callback === "function" ? callback("JSON Error in private section: " + error) : void 0;
          }
          if (typeof callback === "function") {
            callback(null, this);
          }
        }
      }
    };

    StreamObjectReader.prototype._attempt_decrypt_permit = function(permit_id) {
      var author_pubkey, ciphertext, permit_nonce, result, secretkey, _i, _len, _ref;
      author_pubkey = nacl.util.decodeBase64(this.header.keys.curve25519);
      ciphertext = nacl.util.decodeBase64(this.header.audience[permit_id]);
      permit_nonce = nacl.util.decodeBase64(permit_id);
      _ref = this.secrets.curve25519;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        secretkey = _ref[_i];
        result = nacl.box.open(ciphertext, permit_nonce, author_pubkey);
        if (result !== false) {
          if (result.length === (16 + nacl.secretbox.keyLength)) {
            this.nonce16 = result.subarray(0, 16);
            this.secret = result.subarray(16, 16 + nacl.secretbox.keyLength);
            return {
              secret: secretkey,
              nonce: permit_nonce
            };
          } else {
            throw new Error("permit length incorrect");
          }
        }
      }
      return false;
    };

    StreamObjectReader.prototype.validate = function(callback) {
      var _ref;
      if (this.valid !== null) {
        return typeof callback === "function" ? callback(this.valid_err, this.valid) : void 0;
      }
      if (!this.header) {
        return typeof callback === "function" ? callback(this.valid_err = "Header missing", this.valid = false) : void 0;
      }
      if (((_ref = this.header.keys) != null ? _ref.ed25519 : void 0) == null) {
        return typeof callback === "function" ? callback(this.valid_err = "Public keys missing", this.valid = false) : void 0;
      }
      return fs.fstat(this.fd, (function(_this) {
        return function(err, stat) {
          var end, rs, start;
          start = _this.blob_start;
          end = stat.size - nacl.sign.signatureLength;
          rs = fs.createReadStream(null, {
            fd: _this.fd,
            start: start,
            end: end
          });
          rs.on('data', function(buf) {
            return _this.hash.update(buf);
          });
          return rs.on('end', function() {
            var sig_buf;
            sig_buf = new Buffer(nacl.sign.signatureLength);
            return fs.read(_this.fd, sig_buf, 0, sig.length, end, function(err, bytes) {
              var sig;
              sig = new Uint8Array(sig_buf);
              if (err) {
                return typeof callback === "function" ? callback(_this.valid_err = err, _this.valid = false) : void 0;
              } else if (nacl.sign.signatureLength !== bytes) {
                return typeof callback === "function" ? callback(_this.valid_err = "failed reading signature", _this.valid = false) : void 0;
              } else if (nacl.sign.detached.verify(_this.hash.digest(), sig, _this.header.keys.ed25519)) {
                return typeof callback === "function" ? callback(_this.valid_err = null, _this.valid = true) : void 0;
              } else {
                return typeof callback === "function" ? callback(_this.valid_err = "signature invalid", _this.valid = false) : void 0;
              }
            });
          });
        };
      })(this));
    };

    StreamObjectReader.prototype.file_info = function(name) {
      var file, idx, _i, _len, _ref;
      if (!this.header["private"].files) {
        throw new Error("cannot examine encrypted files - not in audience");
      }
      _ref = this.header["private"].files;
      for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
        file = _ref[idx];
        if (file[0] === name) {
          return {
            index: idx,
            name: file[0].toString(),
            type: file[1].toString(),
            size: Math.abs(parseInt(file[2]))
          };
        }
      }
      return null;
    };

    StreamObjectReader.prototype.stream_file = function(file) {
      var cipherstream;
      if (!this.fd) {
        throw new Error("no StreamObject loaded");
      }
      if (typeof file === 'string') {
        file = this.file_info(file);
      }
      if (!(file && file.name)) {
        throw new Error("encrypted file not found");
      }
      cipherstream = fs.createReadStream(null, {
        fd: this.fd,
        highWaterMark: ChunkSize
      });
      return new StreamObjectReader.FileReader({
        chunkSize: ChunkSize,
        fileInfo: file,
        source: cipherstream,
        crypto: this
      });
    };

    StreamObjectReader.prototype.extract_file = function(internal_filename, destination_filename, callback) {
      var error, reader, writer;
      try {
        reader = this.stream_file(internal_filename);
        writer = fs.createWriteStream(destination_filename);
        writer.on("finish", callback);
        return reader.pipe(writer);
      } catch (_error) {
        error = _error;
        return callback(error);
      }
    };

    return StreamObjectReader;

  })();

  StreamObjectWriter = (function() {
    function StreamObjectWriter(options) {
      if (options == null) {
        options = {};
      }
      this.keys = {
        ed25519: nacl.sign.keyPair.fromSecretKey(options.keys.ed25519),
        curve25519: nacl.box.keyPair.fromSecretKey(options.keys.curve25519)
      };
      this.header = {
        id: options.id || nacl.util.encodeBase64(nacl.randomBytes(16)),
        keys: {
          ed25519: nacl.util.encodeBase64(this.keys.ed25519.publicKey),
          curve25519: nacl.util.encodeBase64(this.keys.curve25519.publicKey)
        },
        version: 'A',
        timestamp: Date.now(),
        "private": {
          kind: options.kind || 'post',
          files: []
        }
      };
      this.audience = [this.keys.curve25519.publicKey];
      this.nonce16 = nacl.randomBytes(16);
      this.secret = nacl.randomBytes(nacl.secretbox.keyLength);
      this.hash = new BLAKE2s(32);
      this.files = [];
    }

    StreamObjectWriter.prototype.addFileData = function(name, data, type) {
      var fileInfo;
      if (type == null) {
        type = "";
      }
      if (data.constructor !== Buffer) {
        data = new Buffer(data);
      }
      fileInfo = {
        name: name,
        source: new BufferReadStream(data),
        size: data.length,
        type: type
      };
      this.files.push(fileInfo);
      return this.header["private"].files.push([fileInfo.name, fileInfo.type, fileInfo.size]);
    };

    StreamObjectWriter.prototype.addFile = function(name, path, type) {
      var fileInfo;
      if (type == null) {
        type = "";
      }
      fileInfo = {
        name: name,
        source: fs.createReadStream(path),
        size: fs.statSync(path).size,
        type: type
      };
      this.files.push(fileInfo);
      return this.header["private"].files.push([fileInfo.name, fileInfo.type, fileInfo.size]);
    };

    StreamObjectWriter.prototype.write = function(stream, callback) {
      var ciphered_permit, file, file_index, json_header, json_header_length, permit, permit_nonce, pubkey, raw_stream, _i, _j, _len, _len1, _ref, _ref1;
      if (this.written) {
        return process.nextTick(function() {
          return typeof callback === "function" ? callback('Already written') : void 0;
        });
      }
      this.written = true;
      if (typeof stream === 'string') {
        raw_stream = fs.createWriteStream(stream);
      }
      stream = new StreamDigester();
      stream.pipe(raw_stream);
      this.header["private"] = nacl.util.encodeBase64(nacl.secretbox(nacl.util.decodeUTF8(JSON.stringify(this.header["private"])), NonceFor(this.nonce16, FileID.PrivateSection, 0), this.secret));
      permit = new Uint8Array(16 + nacl.secretbox.keyLength);
      permit.set(this.nonce16, 0);
      permit.set(this.secret, 16);
      this.header.audience = {};
      _ref = this.audience;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        pubkey = _ref[_i];
        permit_nonce = nacl.randomBytes(24);
        ciphered_permit = nacl.box(permit, permit_nonce, pubkey, this.keys.curve25519.secretKey);
        ciphered_permit = nacl.util.encodeBase64(ciphered_permit);
        this.header.audience[nacl.util.encodeBase64(permit_nonce)] = ciphered_permit;
      }
      stream.write(FileStart);
      json_header = JSON.stringify(this.header);
      json_header_length = new Buffer(4);
      json_header_length.writeUInt32BE(Buffer.byteLength(json_header), 0);
      stream.write(json_header_length);
      stream.write(json_header);
      _ref1 = this.files;
      for (file_index = _j = 0, _len1 = _ref1.length; _j < _len1; file_index = ++_j) {
        file = _ref1[file_index];
        file.index = file_index;
      }
      return this._write_next_file(stream, this.files, (function(_this) {
        return function(err) {
          if (err) {
            return typeof callback === "function" ? callback(err) : void 0;
          } else {
            return raw_stream.end(new Buffer(nacl.sign.detached(stream.digest(), _this.keys.ed25519.secretKey), null, callback));
          }
        };
      })(this));
    };

    StreamObjectWriter.prototype._write_next_file = function(output, files, callback) {
      var cipher, thisFile;
      if (files.length === 0) {
        return callback();
      }
      thisFile = files[0];
      cipher = new ChunkCipher({
        fileInfo: thisFile,
        crypto: this
      });
      thisFile.source.pipe(cipher);
      cipher.on('readable', (function(_this) {
        return function() {
          return output.write(cipher.read());
        };
      })(this));
      cipher.on('finish', (function(_this) {
        return function() {
          return _this._write_next_file(output, files.slice(1), callback);
        };
      })(this));
      return cipher.on('error', (function(_this) {
        return function(err) {
          return callback(err);
        };
      })(this));
    };

    return StreamObjectWriter;

  })();

  GenericChunkCipher = (function(_super) {
    __extends(GenericChunkCipher, _super);

    GenericChunkCipher.prototype._inputOverhead = 0;

    function GenericChunkCipher(options) {
      if (options == null) {
        options = {};
      }
      this.chunkSize = (options.chunkSize || ChunkSize) + this._inputOverhead;
      this.fileInfo = options.fileInfo || {
        index: -1
      };
      this._chunkIndex = 0;
      this.crypto = options.crypto;
      this._buffer = new Buffer(0);
      options.highWaterMark = this.chunk_size;
      GenericChunkCipher.__super__.constructor.call(this, options);
    }

    GenericChunkCipher.prototype._transform = function(appendbuf, encoding, done) {
      var err;
      this._buffer = Buffer.concat([this._buffer, appendbuf]);
      while (this._buffer.length >= this.chunkSize) {
        err = this._chunkOut();
      }
      return done(err);
    };

    GenericChunkCipher.prototype._flush = function(done) {
      var err;
      while (this._buffer.length > 0) {
        err = this._chunkOut();
      }
      return done(err);
    };

    GenericChunkCipher.prototype._chunkOut = function() {
      var input, output;
      input = this._buffer.slice(0, this.chunkSize);
      this._buffer = this._buffer.slice(this.chunkSize);
      output = this._process(new Uint8Array(input));
      if (!output) {
        return "Crypto Failure";
      }
      this._chunkIndex += 1;
      this.push(new Buffer(output));
      return null;
    };

    return GenericChunkCipher;

  })(stream.Transform);

  ChunkDecipher = (function(_super) {
    __extends(ChunkDecipher, _super);

    function ChunkDecipher() {
      return ChunkDecipher.__super__.constructor.apply(this, arguments);
    }

    ChunkDecipher.prototype._inputOverhead = nacl.secretbox.overheadLength;

    ChunkDecipher.prototype._process = function(ciphertext) {
      var plaintext;
      return plaintext = nacl.secretbox.open(new Uint8Array(ciphertext), NonceFor(this.crypto.nonce16, this.fileInfo.index, this._chunkIndex), this.crypto.secret);
    };

    return ChunkDecipher;

  })(GenericChunkCipher);

  ChunkCipher = (function(_super) {
    __extends(ChunkCipher, _super);

    function ChunkCipher() {
      return ChunkCipher.__super__.constructor.apply(this, arguments);
    }

    ChunkCipher.prototype._inputOverhead = 0;

    ChunkCipher.prototype._process = function(plaintext) {
      var ciphertext;
      return ciphertext = nacl.secretbox(new Uint8Array(plaintext), NonceFor(this.crypto.nonce16, this.fileInfo.index, this._chunkIndex), this.crypto.secret);
    };

    return ChunkCipher;

  })(GenericChunkCipher);

  StreamDigester = (function(_super) {
    __extends(StreamDigester, _super);

    function StreamDigester(options) {
      if (options == null) {
        options = {};
      }
      this.hash = new BLAKE2s(options.digestLength || 32);
      StreamDigester.__super__.constructor.call(this, options);
    }

    StreamDigester.prototype._transform = function(buffer, encoding, done) {
      this.hash.update(new Uint8Array(buffer));
      return done(null, buffer);
    };

    StreamDigester.prototype.digest = function() {
      return this.hash.digest();
    };

    StreamDigester.prototype.hexDigest = function() {
      return this.hash.hexDigest();
    };

    return StreamDigester;

  })(stream.Transform);

  BufferReadStream = (function(_super) {
    __extends(BufferReadStream, _super);

    function BufferReadStream(buffer, options) {
      this.buffer = buffer;
      if (!(this.buffer instanceof Buffer)) {
        this.buffer = new Buffer(this.buffer);
      }
      this.index = 0;
      BufferReadStream.__super__.constructor.call(this, options);
    }

    BufferReadStream.prototype._read = function(size) {
      var slice;
      if (this.index + size > this.buffer.length) {
        size = this.buffer.length - this.index;
      }
      slice = this.buffer.slice(this.index, this.index + size);
      this.push(slice);
      this.index += size;
      if (this.index >= this.buffer.length) {
        return this.push(null);
      }
    };

    return BufferReadStream;

  })(stream.Readable);

  BufferWriteStream = (function(_super) {
    __extends(BufferWriteStream, _super);

    function BufferWriteStream(options) {
      this.buffer = new Buffer(0);
      BufferWriteStream.__super__.constructor.call(this, options);
    }

    BufferWriteStream.prototype._write = function(chunk, encoding, done) {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      return done();
    };

    BufferWriteStream.prototype.getBuffer = function() {
      return this.buffer;
    };

    return BufferWriteStream;

  })(stream.Writable);

  module.exports = {
    ChunkCipher: ChunkCipher,
    ChunkDecipher: ChunkDecipher,
    BufferReadStream: BufferReadStream,
    BufferWriteStream: BufferWriteStream,
    Reader: StreamObjectReader,
    Writer: StreamObjectWriter
  };

}).call(this);

//# sourceMappingURL=streamobject.js.map