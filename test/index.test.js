'use strict';

var start = require('./common');
var assert = require('power-assert');
var mongoose = start.mongoose;
var Mongoose = mongoose.Mongoose;
var Schema = mongoose.Schema;
var random = require('../lib/utils').random;
var collection = 'blogposts_' + random();

const uri = 'mongodb://localhost:27017/mongoose_test';

describe('mongoose module:', function() {
  describe('default connection works', function() {
    it('without options', function(done) {
      var goose = new Mongoose;
      var db = goose.connection;

      goose.connect(process.env.MONGOOSE_TEST_URI || uri);

      db.on('open', function() {
        db.close(function() {
          done();
        });
      });
    });

    it('with options', function(done) {
      var goose = new Mongoose;
      var db = goose.connection;

      goose.connect(process.env.MONGOOSE_TEST_URI || uri, {});

      db.on('open', function() {
        db.close(function() {
          done();
        });
      });
    });

    it('with promise (gh-3790)', function(done) {
      var goose = new Mongoose;
      var db = goose.connection;

      goose.connect(process.env.MONGOOSE_TEST_URI || uri).then(function() {
        db.close(done);
      });
    });
  });

  it('legacy pluralize by default (gh-5958)', function(done) {
    var mongoose = new Mongoose();

    mongoose.model('User', new Schema({}));

    assert.equal(mongoose.model('User').collection.name, 'users');
    done();
  });

  it('returns legacy pluralize function by default', function(done) {
    var legacyPluralize = require('mongoose-legacy-pluralize');
    var mongoose = new Mongoose();

    var pluralize = mongoose.pluralize();

    assert.equal(pluralize, legacyPluralize);
    done();
  });

  it('sets custom pluralize function (gh-5877)', function(done) {
    var mongoose = new Mongoose();

    // some custom function of type (str: string) => string
    var customPluralize = (str) => str;
    mongoose.pluralize(customPluralize);

    var pluralize = mongoose.pluralize();
    assert.equal(pluralize, customPluralize);

    mongoose.model('User', new Schema({}));
    assert.equal(mongoose.model('User').collection.name, 'User');
    done();
  });

  it('{g,s}etting options', function(done) {
    var mongoose = new Mongoose();

    mongoose.set('a', 'b');
    mongoose.set('long option', 'c');

    assert.equal(mongoose.get('a'), 'b');
    assert.equal(mongoose.set('a'), 'b');
    assert.equal(mongoose.get('long option'), 'c');
    done();
  });

  it('bufferCommands option (gh-5879)', function(done) {
    const mongoose = new Mongoose();

    mongoose.set('bufferCommands', false);

    const M = mongoose.model('Test', new Schema({}));

    assert.ok(!M.collection.buffer);

    done();
  });

  it('cloneSchemas option (gh-6274)', function(done) {
    const mongoose = new Mongoose();

    mongoose.set('cloneSchemas', true);

    const s = new Schema({});
    const M = mongoose.model('Test', s);
    assert.ok(M.schema !== s);
    mongoose.model('Test', M.schema); // Shouldn't throw

    mongoose.set('cloneSchemas', false);

    const M2 = mongoose.model('Test2', s);
    assert.ok(M2.schema === s);

    done();
  });

  it('objectIdGetter option (gh-6588)', function(done) {
    const mongoose = new Mongoose();

    let o = new mongoose.Types.ObjectId();
    assert.strictEqual(o._id, o);

    mongoose.set('objectIdGetter', false);

    o = new mongoose.Types.ObjectId();
    assert.strictEqual(o._id, void 0);

    mongoose.set('objectIdGetter', true);

    o = new mongoose.Types.ObjectId();
    assert.strictEqual(o._id, o);

    done();
  });

  it('runValidators option (gh-6865) (gh-6578)', function() {
    const mongoose = new Mongoose();

    mongoose.set('runValidators', true);

    const M = mongoose.model('Test', new Schema({
      name: { type: String, required: true }
    }));

    return mongoose.connect(uri).
      then(() => M.updateOne({}, { name: null })).
      then(
        () => assert.ok(false),
        err => assert.ok(err.errors['name'])
      ).
      then(() => mongoose.disconnect());
  });

  it('declaring global plugins (gh-5690)', function(done) {
    var mong = new Mongoose();
    var subSchema = new Schema({ name: String });
    var schema = new Schema({
      test: [subSchema]
    });
    var called = 0;

    var calls = [];
    var preSaveCalls = 0;
    mong.plugin(function(s) {
      calls.push(s);

      s.pre('save', function(next) {
        ++preSaveCalls;
        next();
      });

      s.methods.testMethod = function() { return 42; };
    });

    schema.plugin(function(s) {
      assert.equal(s, schema);
      called++;
    });

    var M = mong.model('GlobalPlugins', schema);

    assert.equal(called, 1);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].obj, schema.obj);
    assert.deepEqual(calls[1].obj, subSchema.obj);

    assert.equal(preSaveCalls, 0);
    mong.connect(start.uri);
    M.create({ test: [{ name: 'Val' }] }, function(error, doc) {
      assert.ifError(error);
      assert.equal(preSaveCalls, 2);
      assert.equal(doc.testMethod(), 42);
      assert.equal(doc.test[0].testMethod(), 42);
      mong.disconnect();
      done();
    });
  });

  describe('disconnection of all connections', function() {
    this.timeout(10000);

    describe('no callback', function() {
      it('works', function(done) {
        var mong = new Mongoose();
        var connections = 0;
        var disconnections = 0;
        var pending = 4;

        mong.connect(process.env.MONGOOSE_TEST_URI || uri);
        var db = mong.connection;

        function cb() {
          if (--pending) return;
          assert.equal(connections, 2);
          assert.equal(disconnections, 2);
          done();
        }

        db.on('open', function() {
          connections++;
          cb();
        });

        db.on('close', function() {
          disconnections++;
          cb();
        });

        var db2 = mong.createConnection(process.env.MONGOOSE_TEST_URI || uri);

        db2.on('open', function() {
          connections++;
          cb();
        });

        db2.on('close', function() {
          disconnections++;
          cb();
        });

        mong.disconnect();
      });
    });

    it('with callback', function(done) {
      var mong = new Mongoose();

      mong.connect(process.env.MONGOOSE_TEST_URI || uri);

      mong.connection.on('open', function() {
        mong.disconnect(function() {
          done();
        });
      });
    });

    it('with promise (gh-3790)', function(done) {
      var mong = new Mongoose();

      mong.connect(process.env.MONGOOSE_TEST_URI || uri);

      mong.connection.on('open', function() {
        mong.disconnect().then(function() { done(); });
      });
    });
  });

  describe('model()', function() {
    it('accessing a model that hasn\'t been defined', function(done) {
      var mong = new Mongoose(),
          thrown = false;

      try {
        mong.model('Test');
      } catch (e) {
        assert.ok(/hasn't been registered/.test(e.message));
        thrown = true;
      }

      assert.equal(thrown, true);
      done();
    });

    it('returns the model at creation', function(done) {
      var Named = mongoose.model('Named', new Schema({name: String}));
      var n1 = new Named();
      assert.equal(n1.name, null);
      var n2 = new Named({name: 'Peter Bjorn'});
      assert.equal(n2.name, 'Peter Bjorn');

      var schema = new Schema({number: Number});
      var Numbered = mongoose.model('Numbered', schema, collection);
      var n3 = new Numbered({number: 1234});
      assert.equal(n3.number.valueOf(), 1234);
      done();
    });

    it('prevents overwriting pre-existing models', function(done) {
      var m = new Mongoose;
      m.model('A', new Schema);

      assert.throws(function() {
        m.model('A', new Schema);
      }, /Cannot overwrite `A` model/);

      done();
    });

    it('allows passing identical name + schema args', function(done) {
      const m = new Mongoose;
      const schema = new Schema;
      let model = m.model('A', schema);

      assert.doesNotThrow(function() {
        m.model('A', model.schema);
      });

      done();
    });

    it('throws on unknown model name', function(done) {
      assert.throws(function() {
        mongoose.model('iDoNotExist!');
      }, /Schema hasn't been registered/);

      done();
    });

    describe('passing collection name', function() {
      describe('when model name already exists', function() {
        it('returns a new uncached model', function(done) {
          var m = new Mongoose;
          var s1 = new Schema({a: []});
          var name = 'non-cached-collection-name';
          var A = m.model(name, s1);
          var B = m.model(name);
          var C = m.model(name, 'alternate');
          assert.ok(A.collection.name === B.collection.name);
          assert.ok(A.collection.name !== C.collection.name);
          assert.ok(m.models[name].collection.name !== C.collection.name);
          assert.ok(m.models[name].collection.name === A.collection.name);
          done();
        });
      });
    });

    describe('passing object literal schemas', function() {
      it('works', function(done) {
        var m = new Mongoose;
        var A = m.model('A', {n: [{age: 'number'}]});
        var a = new A({n: [{age: '47'}]});
        assert.strictEqual(47, a.n[0].age);
        done();
      });
    });
  });

  describe('connecting with a signature of uri, options, function', function() {
    it('with single mongod', function(done) {
      var mong = new Mongoose();

      mong.connect(uri, {}, function(err) {
        assert.ifError(err);
        mong.connection.close();
        done();
      });
    });

    it('with replica set', function(done) {
      var mong = new Mongoose();
      var uri = process.env.MONGOOSE_SET_TEST_URI;

      if (!uri) return done();

      mong.connect(uri, {}, function(err) {
        assert.ifError(err);
        mong.connection.close();
        done();
      });
    });
  });

  describe('exports', function() {
    function test(mongoose) {
      assert.equal(typeof mongoose.version, 'string');
      assert.equal(typeof mongoose.Mongoose, 'function');
      assert.equal(typeof mongoose.Collection, 'function');
      assert.equal(typeof mongoose.Connection, 'function');
      assert.equal(typeof mongoose.Schema, 'function');
      assert.ok(mongoose.Schema.Types);
      assert.equal(typeof mongoose.SchemaType, 'function');
      assert.equal(typeof mongoose.Query, 'function');
      assert.equal(typeof mongoose.Promise, 'function');
      assert.equal(typeof mongoose.Model, 'function');
      assert.equal(typeof mongoose.Document, 'function');
      assert.equal(typeof mongoose.Error, 'function');
      assert.equal(typeof mongoose.Error.CastError, 'function');
      assert.equal(typeof mongoose.Error.ValidationError, 'function');
      assert.equal(typeof mongoose.Error.ValidatorError, 'function');
      assert.equal(typeof mongoose.Error.VersionError, 'function');
    }

    it('of module', function(done) {
      test(mongoose);
      done();
    });

    it('of new Mongoose instances', function(done) {
      test(new mongoose.Mongoose);
      done();
    });

    it('of result from .connect() (gh-3940)', function(done) {
      var m = new mongoose.Mongoose;
      m.connect('mongodb://localhost:27017/test').then(function(m) {
        test(m);
        m.disconnect();
        done();
      });
    });
  });
});
