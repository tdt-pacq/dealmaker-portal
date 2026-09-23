/**
 * Annual Success Plans
 *
 * GET    /api/success-plans                 year view (company + roster + rollup)
 * PUT    /api/success-plans/company         company strategy for a year
 * POST   /api/success-plans/years           open another plan year
 * POST   /api/success-plans/people          add someone to the roster
 * PUT    /api/success-plans/people/:id      update that person's plan
 * POST   /api/success-plans/people/:id/archive
 * POST   /api/success-plans/people/:id/restore
 *
 * Auth: basic auth is applied to all /api routes in index.js. These handlers
 * do not add an admin gate. Any signed-in advisor can edit, same as Deal
 * Marketing and Commission Calc. Leadership is not fully represented by the
 * admin role (only some accounts are admin), so a role gate would lock out
 * people who run the plans.
 */

const express = require('express');
const store = require('../successPlanStore');

const router = express.Router();

function send(res, fn) {
  try {
    return fn();
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[Success Plans]', err);
    return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
  }
}

router.get('/', (req, res) => {
  send(res, () => {
    const view = store.getYearView(req.query.year);
    if (!view) return res.status(404).json({ error: 'No success plan for that year' });
    return res.json(view);
  });
});

router.put('/company', (req, res) => {
  send(res, () => res.json(store.saveCompany(req.body || {}, req.user)));
});

router.post('/years', (req, res) => {
  send(res, () => res.status(201).json(store.addYear(req.body || {}, req.user)));
});

router.post('/people', (req, res) => {
  send(res, () => {
    const created = store.addPerson(req.body || {}, req.user);
    return res.status(201).json(created);
  });
});

router.put('/people/:id', (req, res) => {
  send(res, () => res.json(store.savePerson(req.params.id, req.body || {}, req.user)));
});

router.post('/people/:id/archive', (req, res) => {
  send(res, () => res.json(store.setActive(req.params.id, false, req.body?.year)));
});

router.post('/people/:id/restore', (req, res) => {
  send(res, () => res.json(store.setActive(req.params.id, true, req.body?.year)));
});

module.exports = router;
