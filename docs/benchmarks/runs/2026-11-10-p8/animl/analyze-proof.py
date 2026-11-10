import json, math
from pathlib import Path
D=Path(__file__).parent
rows=[json.loads(x) for x in (D/'proof.jsonl').read_text().splitlines() if x.strip()]
labels=['rest','22,12','14,26','39,2','2,20','32,6','leave0','leave0.2','leave0.4']
for label,row in zip(labels,rows):
    v=row['values']; e=(v['upper.tip.x'],v['upper.tip.y']); h=(v['fore.tip.x'],v['fore.tip.y']); pu=(v['pupil.world.x'],v['pupil.world.y'])
    l1=math.hypot(e[0]-8,e[1]-20); l2=math.hypot(h[0]-e[0],h[1]-e[1]); cross=(h[0]-8)*(e[1]-20)-(h[1]-20)*(e[0]-8); pd=math.hypot(pu[0]-32,pu[1]-6)
    print(f'{label}: elbow=({e[0]:.6f},{e[1]:.6f}) hand=({h[0]:.6f},{h[1]:.6f}) L=({l1:.6f},{l2:.6f}) cross={cross:.6f} pupilDist={pd:.9f}')
rr=[json.loads(x) for x in (D/'release-60.jsonl').read_text().splitlines() if x.strip()]
pts=[(r['values']['hand.world.x'],r['values']['hand.world.y']) for r in rr]
j=[math.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(pts,pts[1:])]
print(f'release60: samples={len(pts)} maxStep={max(j):.9f} minStep={min(j):.9f} final=({pts[-1][0]:.6f},{pts[-1][1]:.6f})')
