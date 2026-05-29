const SS_ID = 'YOUR_SPREADSHEET_ID_HERE'; // 替換成你的試算表 ID
const TZ = 'Asia/Ho_Chi_Minh';

function getSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  return {
    vocab: ss.getSheetByName('vocabulary'),
    progress: ss.getSheetByName('progress')
  };
}

function today() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}