import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDailyNewsPost } from '../n-intel-parser';

const edition = `THE DEFENCE ASPIRANTS DAILY
10 NOVEMBER 2026

========================================
1. DEFENCE AND MILITARY AFFAIRS
========================================

1.1 INDIA–OMAN NAVAL EXERCISE: NASEEM AL BAHR

WHY IN NEWS:
INS Surat arrived in Muscat, Oman, ahead of the bilateral maritime exercise.

STRATEGIC SIGNIFICANCE:
1. Strengthens India's maritime presence.
2. Improves cooperation near the Strait of Hormuz.

SOURCE:
Ministry of Defence / PIB
https://www.pib.gov.in/PressRelease.aspx?id=1

========================================
2. INTERNATIONAL RELATIONS
========================================

2.1 INDIA–UKRAINE DIPLOMATIC ENGAGEMENT

WHY IN NEWS:
The leaders held a telephone conversation.

========================================
3. SCIENCE AND TECHNOLOGY
========================================

3.1 TRAI AMENDS TELECOM REGULATIONS

WHY IN NEWS:
TRAI released an amendment to its regulations.

========================================
4. HISTORY, HERITAGE AND CULTURE
========================================

4.1 BUDDHIST RELICS EXHIBITION

WHY IN NEWS:
Sacred relics arrived in Arunachal Pradesh.

========================================
5. GOVERNANCE AND PUBLIC POLICY
========================================

5.1 SWACHH SURVEKSHAN 2025–26

WHY IN NEWS:
The annual cleanliness awards will be presented.

========================================
QUICK REVISION: KEY FACTS TO RETAIN
========================================

1. Naseem Al Bahr – India–Oman bilateral naval exercise.

========================================
END OF SAMPLE EDITION
========================================`;

test('parses Defence Aspirants Daily sections into separate stories', () => {
  const result = parseDailyNewsPost(edition, '2026-11-10');

  assert.equal(result.success, true);
  assert.equal(result.totalStories, 5);
  assert.deepEqual(result.categories, [
    'Defence News',
    'International Relations',
    'Science & Technology',
    'National Affairs',
    'Government Schemes'
  ]);
  assert.deepEqual(result.stories.map(story => story.headline), [
    'INDIA–OMAN NAVAL EXERCISE: NASEEM AL BAHR',
    'INDIA–UKRAINE DIPLOMATIC ENGAGEMENT',
    'TRAI AMENDS TELECOM REGULATIONS',
    'BUDDHIST RELICS EXHIBITION',
    'SWACHH SURVEKSHAN 2025–26'
  ]);
  assert.match(result.stories[0].content, /1\. Strengthens India's maritime presence/);
  assert.match(result.stories[0].content, /2\. Improves cooperation near the Strait of Hormuz/);
  assert.equal(result.stories[0].sourceUrl, 'https://www.pib.gov.in/PressRelease.aspx?id=1');
  assert.ok(result.stories.every(story => !story.content.includes('QUICK REVISION')));
});
