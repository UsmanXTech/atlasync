import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  citationUrl,
  confluencePageUrl,
  jiraIssueUrl,
  jiraProjectUrl,
  jsmRequestUrl,
  recordUrl,
} from './recordLinks.ts';

// Record links (visual-behaviour-test fix #1): every live record opens
// its ORIGINAL record in Jira/Confluence via router.open. These builders
// are the URL half of that — pure, so they are unit-tested here; the
// router.open call itself is a thin best-effort wrapper.
describe('jiraIssueUrl / jsmRequestUrl', () => {
  it('builds /browse/ links from the site URL and key', () => {
    assert.equal(jiraIssueUrl('https://iamusmanh.atlassian.net', 'AT-1'), 'https://iamusmanh.atlassian.net/browse/AT-1');
    assert.equal(jsmRequestUrl('https://iamusmanh.atlassian.net', 'AS-1'), 'https://iamusmanh.atlassian.net/browse/AS-1');
  });

  it('trims a trailing slash from the site URL', () => {
    assert.equal(jiraIssueUrl('https://iamusmanh.atlassian.net/', 'AT-1'), 'https://iamusmanh.atlassian.net/browse/AT-1');
  });

  it('returns null without a site URL or a key', () => {
    assert.equal(jiraIssueUrl(null, 'AT-1'), null);
    assert.equal(jiraIssueUrl('', 'AT-1'), null);
    assert.equal(jiraIssueUrl('https://iamusmanh.atlassian.net', null), null);
    assert.equal(jiraIssueUrl('https://iamusmanh.atlassian.net', ''), null);
  });
});

describe('confluencePageUrl', () => {
  const site = 'https://iamusmanh.atlassian.net';

  it('prefers the _links.webui the API returned', () => {
    assert.equal(
      confluencePageUrl(site, { id: '12', spaceId: '42', webui: '/spaces/AT/pages/12' }),
      'https://iamusmanh.atlassian.net/wiki/spaces/AT/pages/12',
    );
  });

  it('uses a webui that already carries the /wiki prefix as-is', () => {
    assert.equal(
      confluencePageUrl(site, { id: '12', spaceId: '42', webui: '/wiki/spaces/AT/pages/12' }),
      'https://iamusmanh.atlassian.net/wiki/spaces/AT/pages/12',
    );
  });

  it('falls back to spaceId + id when webui is missing', () => {
    assert.equal(
      confluencePageUrl(site, { id: '12', spaceId: '42', webui: null }),
      'https://iamusmanh.atlassian.net/wiki/spaces/42/pages/12',
    );
  });

  it('returns null when neither webui nor spaceId can build a URL', () => {
    assert.equal(confluencePageUrl(site, { id: '12', spaceId: null, webui: null }), null);
    assert.equal(confluencePageUrl(site, { id: '12', spaceId: null, webui: 'not-a-path' }), null);
    assert.equal(confluencePageUrl(null, { id: '12', spaceId: '42', webui: '/spaces/AT/pages/12' }), null);
  });
});

describe('jiraProjectUrl', () => {
  const site = 'https://iamusmanh.atlassian.net';

  it('builds per-type project URLs', () => {
    assert.equal(jiraProjectUrl(site, { key: 'AT', projectType: 'software' }), 'https://iamusmanh.atlassian.net/jira/software/projects/AT');
    assert.equal(jiraProjectUrl(site, { key: 'AS', projectType: 'service_desk' }), 'https://iamusmanh.atlassian.net/jira/servicedesk/projects/AS');
    assert.equal(jiraProjectUrl(site, { key: 'BZ', projectType: 'business' }), 'https://iamusmanh.atlassian.net/jira/core/projects/BZ');
  });

  it('returns null for unknown project types', () => {
    assert.equal(jiraProjectUrl(site, { key: 'AT', projectType: 'Unknown' }), null);
    assert.equal(jiraProjectUrl(site, { key: 'AT' }), null);
    assert.equal(jiraProjectUrl(null, { key: 'AT', projectType: 'software' }), null);
  });
});

describe('recordUrl', () => {
  const site = 'https://iamusmanh.atlassian.net';

  it('dispatches by record kind', () => {
    assert.equal(recordUrl(site, { kind: 'issue', key: 'AT-1' }), 'https://iamusmanh.atlassian.net/browse/AT-1');
    assert.equal(recordUrl(site, { kind: 'request', key: 'AS-1' }), 'https://iamusmanh.atlassian.net/browse/AS-1');
    assert.equal(
      recordUrl(site, { kind: 'page', id: '12', spaceId: '42', webui: null }),
      'https://iamusmanh.atlassian.net/wiki/spaces/42/pages/12',
    );
  });
});

describe('citationUrl', () => {
  it('uses an absolute url as-is and prefixes a site-relative path', () => {
    assert.equal(
      citationUrl('https://iamusmanh.atlassian.net', { path: '/browse/AT-1' }),
      'https://iamusmanh.atlassian.net/browse/AT-1',
    );
    assert.equal(
      citationUrl('https://iamusmanh.atlassian.net', { url: 'https://bitbucket.org/x/pr/1' }),
      'https://bitbucket.org/x/pr/1',
    );
    assert.equal(citationUrl(null, { path: '/browse/AT-1' }), null);
    assert.equal(citationUrl('https://iamusmanh.atlassian.net', {}), null);
  });
});
