// excelAgent.js
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');

// AI가 제공한 JSON 설계도를 바탕으로 엑셀 파일을 생성하는 메인 함수
async function createExcelFromBlueprint(blueprintJSON) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. 설계도 파싱 및 구조 검증
      const blueprint = typeof blueprintJSON === 'string' ? JSON.parse(blueprintJSON) : blueprintJSON;
      
      if (!blueprint.columns || !blueprint.data) {
        throw new Error("설계도 형식이 올바르지 않습니다. (columns, data 필수)");
      }

      // 2. 새 워크북(엑셀 파일)과 시트 생성
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'AI Companion';
      workbook.created = new Date();
      
      const sheetName = blueprint.sheetName || "AI_데이터";
      const sheet = workbook.addWorksheet(sheetName);

      // 3. 열(Column) 헤더 세팅
      // ExcelJS 규격에 맞게 { header: '이름', key: '이름' } 형태로 변환
      sheet.columns = blueprint.columns.map(colName => ({
        header: colName,
        key: colName,
        width: 15 // 기본 너비 지정
      }));

      // 헤더(1행) 스타일 강조 (배경색, 굵게, 가운데 정렬)
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5271FF' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // 4. 데이터(Data) 행 삽입
      // 2차원 배열 [ ["홍길동", 20], ... ] 형태를 삽입
      blueprint.data.forEach(rowData => {
        sheet.addRow(rowData);
      });

      // 5. 수식(Formulas) 적용 (설계도에 formulas 배열이 있을 경우)
      // 예: [ {"cell": "B5", "formula": "SUM(B2:B4)"} ]
      if (blueprint.formulas && Array.isArray(blueprint.formulas)) {
        blueprint.formulas.forEach(f => {
          if (f.cell && f.formula) {
            const targetCell = sheet.getCell(f.cell);
            // ExcelJS에서는 값을 객체 형태로 { formula: "..." } 넣어야 수식으로 작동함
            targetCell.value = { formula: f.formula };
            targetCell.font = { bold: true }; // 수식 결과는 굵게 표시
          }
        });
      }

      // 6. 추가 스타일 아이디어(styleIdeas) 적용
      // 예: [ {"cell": "B5", "color": "FF0000", "bold": true} ]
      if (blueprint.styleIdeas && Array.isArray(blueprint.styleIdeas)) {
        blueprint.styleIdeas.forEach(s => {
          if (s.cell) {
            const targetCell = sheet.getCell(s.cell);
            if (s.bold) {
              targetCell.font = { ...targetCell.font, bold: true };
            }
            if (s.color) {
              // 엑셀은 8자리 ARGB 코드를 사용하므로 6자리 HEX가 오면 앞에 FF를 붙여줌
              const argbColor = s.color.length === 6 ? `FF${s.color}` : s.color;
              targetCell.font = { ...targetCell.font, color: { argb: argbColor } };
            }
            if (s.bg) {
              const argbBg = s.bg.length === 6 ? `FF${s.bg}` : s.bg;
              targetCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBg } };
            }
          }
        });
      }

      // 7. 모든 셀에 기본 테두리(Border) 적용 (깔끔하게 보이기 위함)
      sheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        row.eachCell({ includeEmpty: false }, function(cell, colNumber) {
          cell.border = {
            top: {style:'thin', color: {argb:'FFCCCCCC'}},
            left: {style:'thin', color: {argb:'FFCCCCCC'}},
            bottom: {style:'thin', color: {argb:'FFCCCCCC'}},
            right: {style:'thin', color: {argb:'FFCCCCCC'}}
          };
          if (rowNumber !== 1) { // 1행(헤더) 외에는 기본 가운데 정렬
             cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      });

      // 8. 바탕화면에 실제 물리적 파일로 저장 (.xlsx)
      const desktopPath = path.join(os.homedir(), 'Desktop', `AI_설계문서_${Date.now()}.xlsx`);
      await workbook.xlsx.writeFile(desktopPath);
      
      resolve(desktopPath); // 성공 시 저장된 경로 반환

    } catch (error) {
      reject(error); // 실패 시 에러 던지기
    }
  });
}

// 이 함수를 외부(renderer.js)에서 사용할 수 있도록 내보냅니다.
module.exports = {
  createExcelFromBlueprint
};