/**
 * Golden Gate Park Pianos: backend for goldengateparkpianos.com
 *
 * Lives inside the Google Sheet (Extensions > Apps Script).
 *   GET  -> piano list and status for the website (no combinations)
 *   POST -> saves a form submission and returns that piano's combination
 *
 * First time: run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone).
 */

const PIANOS_SHEET = 'Pianos';
const SUBMISSIONS_SHEET = 'Submissions';

const PIANO_HEADERS = ['id', 'name', 'open', 'status', 'combination'];
const SUBMISSION_HEADERS = [
  'Timestamp', 'Piano', 'First name', 'Last name', 'Email', 'Phone', 'Dry pledge', 'Locked pledge'
];

/** Creates both tabs with headers and starter rows. Safe to run again. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let pianos = ss.getSheetByName(PIANOS_SHEET);
  if (!pianos) {
    pianos = ss.getSheets()[0].getLastRow() === 0
      ? ss.getSheets()[0].setName(PIANOS_SHEET)
      : ss.insertSheet(PIANOS_SHEET);
    pianos.getRange(1, 1, 1, PIANO_HEADERS.length).setValues([PIANO_HEADERS]).setFontWeight('bold');
    pianos.getRange(2, 1, 2, PIANO_HEADERS.length).setValues([
      ['conservatory', 'Conservatory of Flowers', true, 'Open unless rain is forecast', 'NOTE'],
      ['blue-heron', 'Blue Heron Lake', true, 'Open unless rain is forecast', 'NOTE']
    ]);
    pianos.getRange('C2:C50').insertCheckboxes();
    pianos.setFrozenRows(1);
    pianos.autoResizeColumns(1, PIANO_HEADERS.length);
  }

  let subs = ss.getSheetByName(SUBMISSIONS_SHEET);
  if (!subs) {
    subs = ss.insertSheet(SUBMISSIONS_SHEET);
    subs.getRange(1, 1, 1, SUBMISSION_HEADERS.length).setValues([SUBMISSION_HEADERS]).setFontWeight('bold');
    subs.getRange('C:F').setNumberFormat('@'); // keep phone numbers as typed
    subs.setFrozenRows(1);
  }
}

function doGet() {
  const pianos = readPianos_().map(p => ({
    id: p.id,
    name: p.name,
    open: p.open,
    status: p.status
  }));
  return json_({ pianos: pianos, updated: new Date().toISOString() });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Honeypot: real people never fill this in.
    if (data.website) return json_({ ok: false, error: 'Submission rejected.' });

    const required = ['firstName', 'lastName', 'email', 'phone'];
    for (const key of required) {
      if (!String(data[key] || '').trim()) {
        return json_({ ok: false, error: 'Please fill in every field.' });
      }
    }
    if (String(data.dry).trim().toUpperCase() !== 'DRY' ||
        String(data.locked).trim().toUpperCase() !== 'LOCKED') {
      return json_({ ok: false, error: 'Please type DRY and LOCKED to confirm.' });
    }

    // The piano comes from the "Get the code" button people tapped; it's
    // blank if they opened the form directly. The pianos share one lock code.
    const pianos = readPianos_();
    const chosen = pianos.find(p => p.id === String(data.piano || ''));
    const piano = chosen || pianos.find(p => p.open);
    if (!piano) return json_({ ok: false, error: 'The pianos are closed right now.' });
    if (!piano.open) return json_({ ok: false, error: piano.name + ' is closed right now.' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBMISSIONS_SHEET).appendRow([
        new Date(),
        chosen ? chosen.name : '',
        clean_(data.firstName),
        clean_(data.lastName),
        clean_(data.email),
        clean_(data.phone),
        'DRY',
        'LOCKED'
      ]);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true, piano: piano.name, combination: piano.combination });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong saving your info.' });
  }
}

function readPianos_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PIANOS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(h => String(h).trim().toLowerCase());
  return rows
    .filter(r => String(r[headers.indexOf('id')]).trim())
    .map(r => {
      const get = name => r[headers.indexOf(name)];
      const open = get('open') === true || String(get('open')).toUpperCase() === 'TRUE';
      return {
        id: String(get('id')).trim(),
        name: String(get('name')).trim(),
        open: open,
        status: String(get('status') || '').trim() || (open ? 'Open' : 'Closed'),
        combination: String(get('combination') || '').trim()
      };
    });
}

// A leading apostrophe stores values like "+1 415..." as text, so nobody
// can inject a spreadsheet formula.
function clean_(value) {
  const s = String(value || '').trim().slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
