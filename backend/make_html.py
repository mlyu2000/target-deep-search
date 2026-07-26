"""
Render a saved graph JSON into a standalone, interactive D3.js HTML file
(the same force-directed view the frontend uses, but self-contained for demo/sharing).
"""
import json
import os
import sys

IN = sys.argv[1] if len(sys.argv) > 1 else None
OUT = sys.argv[2] if len(sys.argv) > 2 else None

if not IN:
    import glob
    files = sorted(glob.glob(os.path.join(os.path.dirname(__file__), "results", "*.json")))
    IN = files[-1]
if not OUT:
    OUT = IN.replace(".json", ".html")

with open(IN) as f:
    data = json.load(f)

ENT_COLORS = {
    "person": "#0070f8", "organization": "#01a982", "product": "#7764fc",
    "location": "#62e5f6", "technology": "#05cc93",
}

nodes = [{"id": n["id"], "name": n["name"], "type": n["type"]} for n in data["nodes"]]
edges = [{"source": e["source"], "target": e["target"],
          "type": e["type"], "strength": e.get("strength", 3)} for e in data["edges"]]

report_html = ""
rep = data.get("report")
if rep:
    rows = "".join(
        f"<li><b>{k.title()}:</b> {', '.join(str(x.get('name', x)) for x in v[:12]) if isinstance(v, list) else v}</li>"
        for k, v in rep.items() if k != "type" and v
    )
    report_html = f"<div class='report'><h3>{rep.get('target','')} — Business Report</h3><ul>{rows}</ul></div>"

HTML = f"""<!doctype html><html><head><meta charset='utf-8'>
<title>Target Deep Search — {data['target']}</title>
<script src='https://d3js.org/d3.v7.min.js'></script>
<style>
body{{font-family:system-ui,Arial;margin:0;background:#f7f7f7;color:#1d1f27}}
header{{background:#1d1f27;color:#fff;padding:14px 20px}}
header h1{{margin:0;font-size:18px;color:#01a982}}
.wrap{{display:flex}}
#graph{{flex:1;height:78vh}}
.legend{{padding:10px}}
.report{{background:#fff;margin:14px;padding:14px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1)}}
.legend span{{display:inline-block;margin-right:12px}}
.dot{{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}}
.node text{{font-size:11px;pointer-events:none}}
</style></head><body>
<header><h1>Target Deep Search — Relationship Network</h1>
<div>Target: <b>{data['target']}</b> | Depth: {data['depth']} | {len(nodes)} entities, {len(edges)} relationships</div></header>
<div class='wrap'>
<div id='graph'></div>
<div class='legend'>
{"".join(f"<span><span class='dot' style='background:{c}'></span>{t}</span>" for t,c in ENT_COLORS.items())}
{report_html}
</div></div>
<script>
const nodes={json.dumps(nodes)};
const links={json.dumps(edges)};
const color=t=>{{const m={{{','.join(f"'{t}':'{c}'" for t,c in ENT_COLORS.items())}}};return m[t]||'#999'}};
const W=document.getElementById('graph').clientWidth,H=document.getElementById('graph').clientHeight;
const svg=d3.select('#graph').append('svg').attr('width',W).attr('height',H);
const sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(d=>d.id).distance(90))
 .force('charge',d3.forceManyBody().strength(-260)).force('center',d3.forceCenter(W/2,H/2));
const link=svg.append('g').selectAll('line').data(links).join('line').attr('stroke','#bbb').attr('stroke-width',d=>d.strength||1);
const node=svg.append('g').selectAll('g').data(nodes).join('g').call(d3.drag()
 .on('start',(e,d)=>{{sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y}})
 .on('drag',(e,d)=>{{d.fx=e.x;d.fy=e.y}}).on('end',(e,d)=>{{sim.alphaTarget(0);d.fx=null;d.fy=null}}));
node.append('circle').attr('r',9).attr('fill',d=>color(d.type)).attr('stroke','#fff').attr('stroke-width',1.5);
node.append('text').attr('x',12).attr('y',4).text(d=>d.name);
node.append('title').text(d=>`${{d.name}} (${{d.type}})`);
sim.on('tick',()=>{{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
node.attr('transform',d=>`translate(${{d.x}},${{d.y}})`);}});
</script></body></html>"""
with open(OUT, "w") as f:
    f.write(HTML)
print(f"wrote {OUT}")
