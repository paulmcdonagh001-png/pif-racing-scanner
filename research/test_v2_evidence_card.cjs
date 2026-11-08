'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('v2.html', 'utf8');
const startScript = html.indexOf('<script>');
const endScript = html.indexOf('</script>', startScript);
assert(startScript >= 0 && endScript > startScript, 'Embedded scanner script missing');
const code = html.slice(startScript + '<script>'.length, endScript);
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
    course_starts: 0, course_wins: 0,
    similar_trip_starts: 0, similar_trip_top_three: 0,
    similar_going_starts: 0, similar_going_top_three: 0,
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
  '0 recorded hurdle starts at this course', '0 recorded same-type starts near this trip',
  '0 recorded same-type starts on this going', 'FORM · all types',
  '1st Flat', 'Not shortlisted', 'Limited form', 'CD',
]){
  assert(output.includes(phrase), 'Missing: ' + phrase);
}
assert(!output.includes('PIF #1'), 'Unsupported runner incorrectly advertised as PIF pick');
assert(!output.includes('No recent finishing positions recorded'), 'Available cross-code form hidden');
assert(output.includes('evidence-factor unrated'), 'Missing evidence must be labelled');
// A flat debutant or a horse switching surfaces must not look as if
// earlier turf form has disappeared merely because it is not AW evidence.
const crossSurface = {...vulnerable,
  horse:'Iron Curtain', display_prior_runs:2,
  full_history_evidence_facts: {...vulnerable.full_history_evidence_facts,
    last_five_finishes:['5th','2nd'],
    display_history_runs:0, display_all_type_runs:2,
    display_all_type_results:[{finish:'5th',type:'Flat',date:'2026-10-11'},{finish:'2nd',type:'Flat',date:'2026-09-20'}],
  }};
const awRace = {...race, display_race_code:'Flat AW',
  all_runners:[crossSurface, rival]};
const awHtml = row(crossSurface,'Flat',awRace);
for(const phrase of ['Iron Curtain','No verified all-weather starts in this scan',
  '2 earlier races','0 recorded all-weather starts at this course',
  '0 recorded same-type starts near this trip','0 recorded same-type starts on this going']){
  assert(awHtml.includes(phrase),'Missing AW context: '+phrase);
}
const debut = {...crossSurface,horse:'Seddeeg',display_prior_runs:0,
  full_history_evidence_facts:{...crossSurface.full_history_evidence_facts,
    last_five_finishes:[],display_history_runs:0,display_all_type_runs:0,
    display_all_type_results:[]}};
const debutHtml=row(debut,'Flat',{...awRace,all_runners:[debut,rival]});
assert(debutHtml.includes('No previous runs verified in this scan'),
  'Debutant should be distinguished from a first-time AW runner');
// Sandown-style novice hurdler: one completed hurdle, earlier bumper form,
 // no official rating and no same-code form on the advertised going.
const novice = {...vulnerable, horse:'Nimba',display_rank:1,
  other_code_runs_recorded:2,other_code_run_types:{'NH Flat':2},
  jump_research:{recent8_known_outcomes:1,recent8_completions:1},
  full_history_evidence_facts:{...vulnerable.full_history_evidence_facts,
    course_evidence_status:'NOT_RACED_HERE',
    display_all_type_runs:3,display_history_runs:1,
    other_type_similar_going_starts:2,
    other_type_similar_going_top_three:1}};
const noviceRace={...race,all_runners:[novice,rival]};
const noviceHtml=row(novice,'Hurdle',noviceRace);
for(const phrase of ['Limited','33%','Only 1 known jump outcomes',
  'Other race types: 2 NH Flat starts','2 earlier other-type runs on similar going',
  'not evidence of hurdle suitability','Official rating not published']){
  assert(noviceHtml.includes(phrase),'Missing novice context: '+phrase);
}
assert(noviceHtml.includes('<span>Jumping</span><small>Limited</small>'),
  'Jumping sample must not claim an ability rating');
const zeroJumpHtml=row({...novice,
  jump_research:{recent8_known_outcomes:0,recent8_completions:0}},'Hurdle',noviceRace);
assert(zeroJumpHtml.includes('<span>Jumping</span><small>0 starts</small>'),
 'A verified zero-start jump record should not appear as a supplier failure');
const chosen = {...vulnerable, conditions_supported: true, display_rank: 1};
const selectedRace = {...race, all_runners: [chosen, rival],
  conditions_selection_status: 'RESEARCH_SHORTLIST', conditions_selection_count: 1};
const selected = row(chosen, 'Hurdle', selectedRace);
assert(selected.includes('PIF #1'), 'Supported shortlisted runner lost its PIF number');
assert(!selected.includes('Research order #1'), 'Supported shortlist should not be labelled rejected');
const injection = row({...vulnerable,horse:'<script>evil()</script>'},'Hurdle',race);
assert(!injection.includes('<script>evil()'), 'Horse name XSS regression');
console.log('PIF Racing missing-evidence display and shortlist safety checks passed');
