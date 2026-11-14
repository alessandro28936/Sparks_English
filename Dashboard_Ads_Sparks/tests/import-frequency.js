const checks=[];
function check(name,ok){checks.push({name,ok});if(!ok)throw Error(name);}
for(const [v,expected] of [['1,20',1.2],['1,07',1.07],['1.20',1.2],[1.2,1.2],['1',1],[' 2,50 ',2.5],['1,23456',1.23456],['0,00',0],['', ''],[null,'']])check('Frequency '+JSON.stringify(v),readNumber(v,'Frequency')===expected);
for(const v of ['1,234.56','1.234,56','1,2,3','NaN','Infinity']){let rejected=false;try{readNumber(v,'Frequency')}catch(e){rejected=true}check('Reject malformed Frequency '+v,rejected);}
let rejected=false;try{readNumber('1,200','Amount spent (IDR)')}catch(e){rejected=true}check('Spend parser stays strict',rejected);
const Utilities={base64Encode:x=>String(x),computeDigest:(a,b)=>b,DigestAlgorithm:{SHA_256:'test'}};
const headers=['Campaign name','Ad set name','Ad name','Day','Amount spent (IDR)','Results','Reporting starts','Reporting ends','Frequency'];
const data=[headers,...['1,20','1.07',1.5].map((frequency,i)=>['Traffic','BHI_SET','AD_'+i,'2026-11-08',100000,5,'2026-11-08','2026-11-08',frequency])];
const plan=prepare('SE Secondary',data,'upsert','','');
check('Mixed frequency formats accepted in one import',JSON.stringify(plan.rows.map(r=>r.Frequency))==='[1.2,1.07,1.5]');
check('Spend Results and source preserved',plan.rows.every(r=>r.Results===5&&r['Amount spent (IDR)']===100000&&r['Import Source']==='SE Secondary'));
return checks;
