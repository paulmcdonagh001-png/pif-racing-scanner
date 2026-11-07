'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('v2.html', 'utf8');
const scripts = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)];
assert.equal(scripts.length, 1, 'Expected one embedded scanner script');
const code = scripts[0][1];
const begin = code.indexOf('function row(h,raceType,race){');
const end = code.indexOf('async function updateForwardRecord(){', begin);
assert(begin >= 0 && end > begin, 'Compact horse renderer not found');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const row = vm.runInNewContext(code.slice(begin, end) + '\nrow;', {
  escapeHtml, raceKey: () => 'test-race',
});

const vulnerable = {
  horse_id: 'hrs_lunar', horse: 'Lunar Trix', card_number: '2',
  display_rank: 1, conditions_supported: false, display_prior_runs: 0,
  jockey_name: 'Charlie Hammond', trainer_name: 'Stuart Edmunds',
  quote: {decimal: 2.28, source: 'Betfair Exchange'},
  course_distance_badges: ['CD'],
  evidence_facts: {
    last_five_finishes: [], official_rating: null,
    trainer_60d: {wins: 8, runs: 32}, jockey_60d: {wins: 5, runs: 28}
  },
  full_history_evidence_facts: {
    last_five_finishes: [], official_rating: null,
    trainer_60d: {wins: 8, runs: 32}, jockey_60d: {wins: 5, runs: 28},
    course_evidence_status: 'NO_PREVIOUS_FORM',
    display_all_type_results: [{finish: '1st', type: 'Flat', date: '2026-10-01'}]
  },
  jump_research: {},
  conditions_exclusion_reasons: ['Fewer than three verified same-type starts'],
};
const rival = {
  ...vulnerable, horse_id: 'hrs_rival', horse: 'Second runner',
  display_rank: 2, conditions_supported: false, course_distance_badges: [],
  full_history_evidence_facts: {...vulnerable.full_history_evidence_facts,
    trainer_60d: {wins: 1, runs: 32}, jockey_60d: {wins: 2, runs: 28}}
};
const race = {
  all_runners: [vulnerable, rival], conditions_selection_status: 'NO_SUPPORTED_SELECTION',
  conditions_selection_count: 0,
};
const output = row(vulnerable, 'Hurdle', race);
for(const phrase of [
  'Lunar Trix', '2.28', 'Research order #1',
  'Official rating not published', 'Verified jump completion record unavailable',
  'No usable same-type form at this course', 'No usable same-type results near this trip',
  'No usable same-type results on this going', 'FORM · all types',
  '1st Flat', 'Not shortlisted', 'Limited form', 'CD',
]){
  assert(output.includes(phrase), 'Missing: ' + phrase);
}
assert(!output.includes('PIF #1'), 'Unsupported runner incorrectly advertised as PIF pick');
assert(!output.includes('No recent finishing positions recorded'), 'Available cross-code form hidden');
assert(output.includes('evidence-factor unrated'), 'Missing evidence must be labelled');
const chosen = {...vulnerable, conditions_supported: true, display_rank: 1};
const selectedRace = {...race, all_runners: [chosen, rival],
  conditions_selection_status: 'RESEARCH_SHORTLIST', conditions_selection_count: 1};
const selected = row(chosen, 'Hurdle', selectedRace);
assert(selected.includes('PIF #1'), 'Supported shortlisted runner lost its PIF number');
assert(!selected.includes('Research order #1'), 'Supported shortlist should not be labelled rejected');
const injection = row({...vulnerable,horse:'<script>evil()</script>'},'Hurdle',race);
assert(!injection.includes('<script>evil()'), 'Horse name XSS regression');
console.log('PIF Racing missing-evidence display and shortlist safety checks passed');
