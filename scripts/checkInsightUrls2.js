const https = require('https');
const fs = require('fs');

const words = ['감사','골고다','등불','레위인','물두멍','관유','뜰문','구름기둥','물맷돌','안수','양떼','어부','온전함','유혹','의로움','죄악','천국','필사본','하느님의 날','화목제','흉패','가룟 유다','마술사 시몬','성별','분별','분향단','불순종','번역','세과세','삽넉가래','사생아','예언서','정결례','제사직','장자권','자제력','우상숭배','아그립바','속죄판','시간시','세대대','벽성벽담','법율법','브에라','베레스','바아나','뿔','비파','대속물','미늘 갑옷','경건한 정성','포도주와 독한 술','복음 전파자','보석과 귀한 돌','바다표범 가죽','보고(寶庫)','심판대','안식일','전파자','충실하고 슬기로운 종','초막절 축제','안식','심판','전파','충실','초막절','대속','갑옷','경건','포도주','복음','보석','바다표범','보고','배'];

const unique = [...new Set(words)];
let done = 0;
const total = unique.length;
const results = {};

unique.forEach(word => {
  const url = 'https://www.jw.org/ko/%EB%9D%BC%EC%9D%B4%EB%B8%8C%EB%9F%AC%EB%A6%AC/%EC%84%9C%EC%A0%81/%EC%84%B1%EA%B2%BD-%ED%86%B5%EC%B0%B0/' + encodeURIComponent(word) + '/';
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    results[word] = res.statusCode;
    res.resume();
    done++;
    if (done === total) {
      const notFound = Object.entries(results).filter(([_, c]) => c === 404);
      const found = Object.entries(results).filter(([_, c]) => c === 200);
      console.log('=== 404 (NOT in Insight) ===');
      notFound.forEach(([w, c]) => console.log(w + ' => ' + c));
      console.log('\n=== 200 (In Insight) ===');
      found.forEach(([w, c]) => console.log(w + ' => ' + c));
      console.log('\nTotal 404: ' + notFound.length + ', Total 200: ' + found.length);
    }
  }).on('error', e => {
    results[word] = 'ERR';
    done++;
    if (done === total) {
      const notFound = Object.entries(results).filter(([_, c]) => c === 404);
      const found = Object.entries(results).filter(([_, c]) => c === 200);
      console.log('=== 404 (NOT in Insight) ===');
      notFound.forEach(([w, c]) => console.log(w + ' => ' + c));
      console.log('\n=== 200 (In Insight) ===');
      found.forEach(([w, c]) => console.log(w + ' => ' + c));
      console.log('\nTotal 404: ' + notFound.length + ', Total 200: ' + found.length);
    }
  });
});
