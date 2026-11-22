"""Build the portable, single-file dashboard. No dependencies required."""
import base64
from pathlib import Path

root = Path(__file__).resolve().parent
shell = (root / 'src/shell.html').read_text(encoding='utf-8')
for marker, source in [('/* STYLES */', 'styles.css'), ('/* ANALYTICS */', 'analytics.js'), ('/* APP */', 'app.js')]:
    content = (root / 'src' / source).read_text(encoding='utf-8')
    if source == 'styles.css':
        content += '\n' + (root / 'src/center-map.css').read_text(encoding='utf-8')
        content += '\n' + (root / 'src/center-periods.css').read_text(encoding='utf-8')
    if source == 'app.js':
        content = content.replace('/* CENTER_PERIODS */', (root / 'src/center-periods.js').read_text(encoding='utf-8'))
        content = content.replace('/* METRIC_SCORECARDS */', (root / 'src/metric-scorecards.js').read_text(encoding='utf-8') + '\n' + (root / 'src/scorecard-targets.js').read_text(encoding='utf-8'))
        content = content.replace('/* CENTER_MAP */', (root / 'src/map-geography.js').read_text(encoding='utf-8') + '\n' + (root / 'src/center-map.js').read_text(encoding='utf-8'))
        content = content.replace('/* PRIORITIES */', (root / 'src/priorities.js').read_text(encoding='utf-8'))
        content = content.replace('/* COST_TARGETS */', (root / 'src/cost-targets.js').read_text(encoding='utf-8'))
        content = content.replace('/* WORK_SCOPE */', (root / 'src/work-scope.js').read_text(encoding='utf-8'))
        content = content.replace('/* TIME_CHARTS */', (root / 'src/time-charts.js').read_text(encoding='utf-8'))
        content = content.replace('/* COMPARISON */', (root / 'src/comparison.js').read_text(encoding='utf-8'))
        content = content.replace('/* RULES */', (root / 'src/rules.js').read_text(encoding='utf-8'))
        content = content.replace('/* AD_PERIODS */', (root / 'src/ad-periods.js').read_text(encoding='utf-8'))
        content = content.replace('/* ITERATION */', (root / 'src/iteration.js').read_text(encoding='utf-8'))
        content = content.replace('/* MEETING */', (root / 'src/meeting.js').read_text(encoding='utf-8'))
        content = content.replace('/* DATE_RANGE */', (root / 'src/date-range.js').read_text(encoding='utf-8'))
        content = content.replace('/* DATA_FLOW */', (root / 'src/data-flow.js').read_text(encoding='utf-8'))
        content = content.replace('/* ADSETS */', (root / 'src/adsets.js').read_text(encoding='utf-8'))
        content = content.replace('/* REPORT_SUMMARY */', (root / 'src/report-summary.js').read_text(encoding='utf-8'))
        content = content.replace('/* CONTENT_RANKING */', (root / 'src/content-ranking.js').read_text(encoding='utf-8'))
        content = content.replace('/* ACCOUNTS */', (root / 'src/accounts.js').read_text(encoding='utf-8'))
        for city in ('bandung', 'yogya', 'surabaya', 'bali'):
            tile = (root / 'src/city-maps' / (city + '.webp')).read_bytes()
            content = content.replace('__CITY_MAP_' + city + '__', 'data:image/webp;base64,' + base64.b64encode(tile).decode('ascii'))
    shell = shell.replace(marker, content)
(root / 'Dashboard_ads.html').write_text(shell, encoding='utf-8')
print('Built Dashboard_ads.html (single file)')
