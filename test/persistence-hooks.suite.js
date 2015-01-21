var DataSource = require('../').DataSource;
var traverse = require('traverse');

module.exports = function(connectorFactory, should) {
  describe('Persistence hooks', function() {
    var observedContexts, expecterError, observersCalled;
    var ds, TestModel, existingModel;

    beforeEach(function setupEnv(done) {
      observedContexts = "hook not called";
      expecterError = new Error('test error');
      observersCalled = [];

      ds = new DataSource({ connector: connectorFactory });
      TestModel = ds.createModel('TestModel', { name: String });

      TestModel.create({ name: 'first' }, function(err, model) {
        if (err) return done(err);
        existingModel = model;

        TestModel.create({ name: 'second' }, function(err) {
          if (err) return done(err);
          done();
        });
      });
    });

    describe('PersistedModel.find', function() {
      it('triggers `before load` hook', function(done) {
        TestModel.observe('before load', pushContextAndNext());

        TestModel.find({ where: { id: 1 } }, function(err, list) {
          if (err) return done(err);
          observedContexts.should.eql({ query: { where: { id: 1 } } });
          done();
        });
      });

      it('aborts when `before load` hook fails', function(done) {
        TestModel.observe('before load', nextWithError(expecterError));

        TestModel.find(function(err, list) {
          [err].should.eql([expecterError]);
          done();
        });
      });

      // TODO: geo query

      // TODO: after load
    });

    describe('PersistedModel.create', function() {
      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.create({ name: 'created' }, function(err, list) {
          if (err) return done(err);
          observedContexts.should.eql({ model: {
            id: undefined,
            name: 'created'
          }});
          done();
        });
      });

      it('aborts when `before load` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expecterError));

        TestModel.create({ name: 'created' }, function(err, list) {
          [err].should.eql([expecterError]);
          done();
        });
      });

      it('send notification for each item in array of models', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.create(
          [{ name: 'one' }, { name: 'two' }],
          function(err, list) {
            if (err) return done(err);
            observedContexts.should.eql([
              { model: { id: undefined, name: 'one' } },
              { model: { id: undefined, name: 'two' } },
            ]);
            done();
          });
      });

      // TODO after save
      // TODO before/after save for array when observer fails
    });

    describe('PersistedModel.findOrCreate', function() {
      it('triggers `before load` hook', function(done) {
        TestModel.observe('before load', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);
            observedContexts.should.eql({ query: {
              where: { name: 'new-record' },
              limit: 1,
              offset: 0,
              skip: 0
            }});
            done();
          });
      });

      // TODO, perhaps it's ok to let default impl not fire the event
      // and connector-specific optimized impls to fire it?
      it.skip('triggers `before save` hook when found', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: existingModel.name } },
          { name: existingModel.name },
          function(err, record, created) {
            if (err) return done(err);
            observedContexts.should.eql({ model: {
              id: undefined,
              name: existingModel.name
            }});
            done();
          });
      });

      it('triggers `before save` hook when not found', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);
            observedContexts.should.eql({ model: {
              id: undefined,
              name: 'new-record'
            }});
            done();
          });
      });

      // TODO: before save error cancels the operation
      // TODO: order of hooks
      // TODO: after save when found - not called
      // TODO: after save when not found - is called
    });

    function pushContextAndNext() {
      return function(context, next) {
        context = deepCloneToObject(context);

        if (typeof observedContexts === 'string') {
          observedContexts = context;
          return next();
        }

        if (!Array.isArray(observedContexts)) {
          observedContexts = [observedContexts];
        }

        observedContexts.push(context);
        next();
      };
    }

    function addObserverNameAndNext(name) {
      return function(context, next) {
        observersCalled.push(name);
      };
    }

    function nextWithError(err) {
      return function(context, next) {
        next(err);
      };
    }
  });
};

function deepCloneToObject(obj) {
  return traverse(obj).map(function(x) {
    if (x && x.toObject) return x.toObject(true);
  });
}
