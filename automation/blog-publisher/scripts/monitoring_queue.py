"""Plan existing-run SEO reviews from public-safe evidence. No network or writes."""
import calendar
import json
import sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

CENTRAL = ZoneInfo('America/Chicago')


def instant(value):
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def coverage(row):
    if row.get('error'):
        return 'inspection_error'
    if row.get('source') != 'google_url_inspection':
        return 'unverified'
    state = (row.get('coverageState') or '').lower()
    if 'not indexed' in state or 'unknown' in state:
        return 'not_indexed'
    if row.get('verdict') == 'PASS':
        return 'indexed'
    return 'other'


def page_plan(page, now, alerted):
    if page.get('excluded'):
        return None
    published = instant(page.get('publishedAt') or page.get('firstSeenAt'))
    if published is None:
        raise ValueError('A publication or first-seen observation time is required')
    if published > now:
        raise ValueError('Future publication time')
    today = now.astimezone(CENTRAL).date()
    age = (today - published.astimezone(CENTRAL).date()).days
    history = sorted(page.get('history', []), key=lambda r: instant(r['inspectedAt']))
    if any(instant(r['inspectedAt']) > now for r in history):
        raise ValueError('Future inspection time')
    successful = [r for r in history if coverage(r) not in ('inspection_error', 'unverified')]
    latest = successful[-1] if successful else None
    status = coverage(latest) if latest else 'unavailable'
    last_time = instant(latest['inspectedAt']) if latest else None
    last_indexed = next((i for i in range(len(successful)-1, -1, -1) if coverage(successful[i]) == 'indexed'), None)
    pending = successful[last_indexed+1:] if last_indexed is not None else successful
    tail = []
    for row in reversed(pending):
        if coverage(row) != 'not_indexed':
            break
        tail.insert(0, row)
    span = instant(tail[-1]['inspectedAt']) - instant(tail[0]['inspectedAt']) if tail else timedelta(0)
    if not history:
        due = True
    elif coverage(history[-1]) in ('inspection_error', 'unverified'):
        due = (today - instant(history[-1]['inspectedAt']).astimezone(CENTRAL).date()).days >= 1
    elif status == 'indexed':
        due = now - last_time >= timedelta(days=28)
    elif status == 'not_indexed' and last_indexed is not None:
        confirmed = len(tail) >= 2 and span >= timedelta(days=1)
        due = now - last_time >= timedelta(days=7 if confirmed else 1)
    else:
        last_age = (last_time.astimezone(CENTRAL).date() - published.astimezone(CENTRAL).date()).days
        next_age = next((v for v in (3, 7, 14, 28) if v > last_age), None)
        if next_age is not None:
            due = age >= next_age
        else:
            due = now - last_time >= timedelta(days=7 if age <= 56 else 28)
    fresh = bool(last_time and now - last_time <= timedelta(days=2))
    tech_time = instant(page.get('technicalVerifiedAt'))
    tech_fresh = bool(tech_time and timedelta(0) <= now - tech_time <= timedelta(days=1))
    candidate = None
    if page.get('technicalIssueConfirmed') is True and page.get('technicalIssue') and tech_fresh:
        candidate = 'technical:' + page['technicalIssue']
    elif status == 'not_indexed' and fresh:
        if len(tail) >= 2:
            if last_indexed is not None and span >= timedelta(days=1):
                candidate = 'indexing_regression_review'
            elif last_indexed is None and age >= 14 and span >= timedelta(days=7):
                candidate = 'persistent_indexing_review'
    eligible = tech_fresh and page.get('technicalEligible') is True
    ready = bool(candidate and (candidate.startswith('technical:') or eligible))
    key = page['url'] + '|' + candidate if candidate else None
    return {'url': page['url'], 'ageDays': age, 'ageBasis': 'publication' if page.get('publishedAt') else 'first_seen_only', 'googleStatus': status,
            'regressionSuspected': status == 'not_indexed' and last_indexed is not None,
            'inspectionDue': due, 'reviewCandidate': candidate,
            'refreshTechnicalQA': bool(candidate and not eligible),
            'notificationCandidate': bool(ready and key not in alerted),
            'issueKey': key}


def plan(data):
    now = instant(data.get('now')) or datetime.now(timezone.utc)
    today = now.astimezone(CENTRAL).date()
    week = f'{today.isocalendar().year}-W{today.isocalendar().week:02d}'
    first_week = data.get('firstWeeklyPeriod')
    started = week >= first_week if first_week else today.weekday() == 0 or bool(data.get('lastWeeklyKey'))
    weekly = data.get('lastWeeklyKey') != week and started
    month_key = None
    month_status = 'settled_data_unavailable'
    settled = date.fromisoformat(data['settledThrough']) if data.get('settledThrough') else None
    if settled:
        if settled >= today:
            raise ValueError('Settled reporting date must precede current Central date')
        year, month = today.year, today.month - 1
        if month == 0:
            year, month = year - 1, 12
        end = date(year, month, calendar.monthrange(year, month)[1])
        target = f'{year}-{month:02d}'
        month_status = 'prior_month_incomplete' if settled < end else 'not_started'
        if settled >= end and target >= data.get('firstMonthlyPeriod', '9999-12'):
            month_key = target
            month_status = 'complete' if data.get('lastMonthlyKey') == target else 'due'
    pages = data.get('pages', [])
    urls = [p['url'] for p in pages if not p.get('excluded')]
    if len(urls) != len(set(urls)):
        raise ValueError('Duplicate canonical URLs in monitoring input')
    rows = [page_plan(p, now, set(data.get('alertedKeys', []))) for p in pages]
    rows = [r for r in rows if r is not None]
    used = data.get('inspectionCallsUsed', 0)
    if not isinstance(used, int) or isinstance(used, bool) or not 0 <= used <= 20:
        raise ValueError('inspectionCallsUsed must be an integer from0to20')
    ordered = sorted([r for r in rows if r['inspectionDue']], key=lambda r: (not r['regressionSuspected'], -r['ageDays'], r['url']))
    queue = ordered[:20-used]
    return {'weeklyPeriodKey': week, 'weeklyReviewDue': weekly,
            'monthlyPeriodKey': month_key,
            'monthlyReviewDue': bool(month_key and data.get('lastMonthlyKey') != month_key),
            'monthlyDataDeferred': month_status in ('settled_data_unavailable', 'prior_month_incomplete'),
            'monthlyStatus': month_status,
            'inspectionQueue': [r['url'] for r in queue],
            'deferredInspections': len(ordered) - len(queue),
            'pages': rows, 'note': 'Planner only. Verify current evidence; bound inspections to20/run. No alert was sent.'}


if __name__ == '__main__':
    print(json.dumps(plan(json.load(sys.stdin)), indent=2))
