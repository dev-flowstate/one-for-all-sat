import { chromium } from 'playwright';
const shotDir='C:/Users/hp/AppData/Local/Temp/claude/d--SAT/9191810e-ec22-4221-8db1-769ecea84bc0/scratchpad/shots';
const errors=[];
const b=await chromium.launch({args:['--no-sandbox']});
async function go(label,w,h,domain){
  const p=await b.newPage({viewport:{width:w,height:h}});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:5173/one-for-all-sat/#/setup');
  await p.waitForSelector('text=Set up a session');
  await p.click(`text=${domain}`);
  await p.waitForTimeout(250);
  await p.click('button:has-text("Start practicing")');
  await p.waitForSelector('text=Answer Eliminator',{timeout:15000});
  await p.waitForTimeout(700);
  await p.screenshot({path:`${shotDir}/F-${label}.png`,fullPage:true});
  await p.close();
}
await go('desktop-rw',1280,900,'Craft and Structure');
await go('desktop-math',1280,900,'Algebra');
await go('mobile-rw',390,844,'Craft and Structure');
await b.close();
console.log('ERRORS:',errors.length?JSON.stringify(errors.slice(0,3)):'none');
