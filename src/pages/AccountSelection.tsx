import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Search, Upload, ClipboardPaste, Building2, Save, Plus, Minus, ArrowRightLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';

export const INITIAL_CATEGORIES = [
  {
    name: '제조 - 직원급여',
    accounts: [
      { id: 'acc_A60300101', code: 'A60300101', name: '제조비용_직원급여_급여' },
      { id: 'acc_A60300102', code: 'A60300102', name: '제조비용_직원급여_상여' },
      { id: 'acc_A60300103', code: 'A60300103', name: '제조비용_직원급여_시간외수당' },
      { id: 'acc_A60300104', code: 'A60300104', name: '제조비용_직원급여_연차수당' },
      { id: 'acc_A60300107', code: 'A60300107', name: '제조비용_직원급여_조정수당' },
      { id: 'acc_A60300109', code: 'A60300109', name: '제조비용_직원급여_직책수당' },
      { id: 'acc_A60300111', code: 'A60300111', name: '제조비용_직원급여_직원경영성과금' },
      { id: 'acc_A60300112', code: 'A60300112', name: '제조비용_직원급여_휴일근무수당' },
      { id: 'acc_A60300114', code: 'A60300114', name: '제조비용_직원급여_자녀교육비' },
      { id: 'acc_A60300115', code: 'A60300115', name: '제조비용_직원급여_주택임차료' },
      { id: 'acc_A60300199', code: 'A60300199', name: '제조비용_직원급여_기타수당' },
    ]
  },
  {
    name: '제조 - 퇴직급여충당부채전입액',
    accounts: [
      { id: 'acc_A60300501', code: 'A60300501', name: '제조비용_퇴직급여충당부채전입액_사내' },
      { id: 'acc_A60300504', code: 'A60300504', name: '제조비용_퇴직급여충당부채전입액_임원' },
    ]
  },
  {
    name: '제조 - 임원급여',
    accounts: [
      { id: 'acc_A60300701', code: 'A60300701', name: '제조비용_임원급여_급여' },
      { id: 'acc_A60300703', code: 'A60300703', name: '제조비용_임원급여_임원활동수당' },
      { id: 'acc_A60300712', code: 'A60300712', name: '제조비용_임원급여_임원경영성과금' },
    ]
  },
  {
    name: '제조 - 협력작업',
    accounts: [
      { id: 'acc_A60401100', code: 'A60401100', name: '제조비용_협력작업_작업비(변동비)' },
      { id: 'acc_A60401200', code: 'A60401200', name: '제조비용_협력작업_작업비(고정비)' },
      { id: 'acc_A60404101', code: 'A60404101', name: '제조비용_협력작업_수선비' },
    ]
  },
  {
    name: '제조 - 외주용역비',
    accounts: [
      { id: 'acc_A60405109', code: 'A60405109', name: '제조비용_외주용역비_정비용역비' },
    ]
  },
  {
    name: '제조 - 감가상각비',
    accounts: [
      { id: 'acc_A60500101', code: 'A60500101', name: '제조비용_유형자산 감가상각비' },
      { id: 'acc_A60501102', code: 'A60501102', name: '제조비용_무형자산 감가상각비' },
      { id: 'acc_A60501306', code: 'A60501306', name: '제조비용_사용권자산감가상각비_차량운반구' },
    ]
  },
  {
    name: '제조 - 복리후생비',
    accounts: [
      { id: 'acc_A60601101', code: 'A60601101', name: '제조비용_복리후생비_건강보험료' },
      { id: 'acc_A60601102', code: 'A60601102', name: '제조비용_복리후생비_산재보험료' },
      { id: 'acc_A60601103', code: 'A60601103', name: '제조비용_복리후생비_국민연금' },
      { id: 'acc_A60601104', code: 'A60601104', name: '제조비용_복리후생비_고용보험료' },
      { id: 'acc_A60601105', code: 'A60601105', name: '제조비용_복리후생비_직원중식비' },
      { id: 'acc_A60601115', code: 'A60601115', name: '제조비용_복리후생비_보건위생지원' },
      { id: 'acc_A60601122', code: 'A60601122', name: '제조비용_동호회별그룹활동지원' },
      { id: 'acc_A60601123', code: 'A60601123', name: '제조비용_복리후생비_직원간담회지원' },
      { id: 'acc_A60601148', code: 'A60601148', name: '제조비용_복리후생비_학자보조금' },
      { id: 'acc_A60601150', code: 'A60601150', name: '제조비용_복리후생비_식대지원비' },
      { id: 'acc_A60601151', code: 'A60601151', name: '제조비용_복리후생비_건강검진비' },
      { id: 'acc_A60601155', code: 'A60601155', name: '제조비용_복리후생비_부서별그룹활동지원' },
      { id: 'acc_A60601156', code: 'A60601156', name: '제조비용_복리후생비_복리후생비_행사지원비' },
      { id: 'acc_A60601158', code: 'A60601158', name: '제조비용_복리후생비_차량유류지원비' },
      { id: 'acc_A60601159', code: 'A60601159', name: '제조비용_복리후생비_사내경조사비' },
      { id: 'acc_A60601163', code: 'A60601163', name: '제조비용_복리후생비_복지카드비용' },
      { id: 'acc_A60601175', code: 'A60601175', name: '제조비용_복리후생비_출산장려지원금' },
      { id: 'acc_A60601199', code: 'A60601199', name: '제조비용_복리후생비_기타복리후생비' },
    ]
  },
  {
    name: '제조 - 여비교통비',
    accounts: [
      { id: 'acc_A60602101', code: 'A60602101', name: '제조비용_여비교통비_국내여비' },
      { id: 'acc_A60602102', code: 'A60602102', name: '제조비용_여비교통비_해외여비' },
    ]
  },
  {
    name: '제조 - 통신비',
    accounts: [
      { id: 'acc_A60603102', code: 'A60603102', name: '제조비용_통신비_무선전화사용료' },
      { id: 'acc_A60603105', code: 'A60603105', name: '제조비용_통신비_우편료' },
      { id: 'acc_A60603199', code: 'A60603199', name: '제조비용_통신비_기타' },
    ]
  },
  {
    name: '제조 - 전력비',
    accounts: [
      { id: 'acc_A60604101', code: 'A60604101', name: '제조비용_전력비_변동' },
      { id: 'acc_A60604201', code: 'A60604201', name: '제조비용_전력비_고정' },
    ]
  },
  {
    name: '제조 - 용수비',
    accounts: [
      { id: 'acc_A60605101', code: 'A60605101', name: '제조비용_용수비_변동비' },
      { id: 'acc_A60605201', code: 'A60605201', name: '제조비용_용수비_고정비' },
    ]
  },
  {
    name: '제조 - 연료유지비',
    accounts: [
      { id: 'acc_A60606101', code: 'A60606101', name: '제조비용_연료유지비' },
    ]
  },
  {
    name: '제조 - 세금과공과',
    accounts: [
      { id: 'acc_A60607101', code: 'A60607101', name: '제조비용_세금과공과_종업원할사업소세' },
      { id: 'acc_A60607103', code: 'A60607103', name: '제조비용_세금과공과_재산세_건물분' },
      { id: 'acc_A60607104', code: 'A60607104', name: '제조비용_세금과공과_재산세_토지분' },
      { id: 'acc_A60607105', code: 'A60607105', name: '제조비용_세금과공과_주민세' },
      { id: 'acc_A60607106', code: 'A60607106', name: '제조비용_세금과공과_면허세' },
      { id: 'acc_A60607108', code: 'A60607108', name: '제조비용_세금과공과_수입인지대' },
      { id: 'acc_A60607111', code: 'A60607111', name: '제조비용_세금과공과_자동차세' },
      { id: 'acc_A60607112', code: 'A60607112', name: '제조비용_세금과공과_등록세' },
      { id: 'acc_A60607199', code: 'A60607199', name: '제조비용_세금과공과_기타' },
    ]
  },
  {
    name: '제조 - 지급임차료',
    accounts: [
      { id: 'acc_A60609101', code: 'A60609101', name: '제조비용_지급임차료_차량임차료' },
      { id: 'acc_A60609103', code: 'A60609103', name: '제조비용_지급임차료_주택및숙소임차료' },
      { id: 'acc_A60609108', code: 'A60609108', name: '제조비용_지급임차료_보세장치장/창고사용료' },
      { id: 'acc_A60609112', code: 'A60609112', name: '제조비용_지급임차료_중장비임차료' },
      { id: 'acc_A60609199', code: 'A60609199', name: '제조비용_지급임차료_기타' },
    ]
  },
  {
    name: '제조 - 수선비',
    accounts: [
      { id: 'acc_A60610108', code: 'A60610108', name: '제조비용_수선비_EIC' },
      { id: 'acc_A60610121', code: 'A60610121', name: '제조비용_수선비_기계장치' },
      { id: 'acc_A60610199', code: 'A60610199', name: '제조비용_수선비_기타' },
    ]
  },
  {
    name: '제조 - 보험료',
    accounts: [
      { id: 'acc_A60611101', code: 'A60611101', name: '제조비용_보험료_화재및기계기관' },
      { id: 'acc_A60611102', code: 'A60611102', name: '제조비용_보험료_종업원재해보장' },
      { id: 'acc_A60611105', code: 'A60611105', name: '제조비용_보험료_가스배상책임' },
      { id: 'acc_A60611110', code: 'A60611110', name: '제조비용_보험료_보증보험료' },
    ]
  },
  {
    name: '제조 - 경상연구개발비',
    accounts: [
      { id: 'acc_A60614105', code: 'A60614105', name: '제조비용_경상연구개발비_연구자문비' },
    ]
  },
  {
    name: '제조 - 지급수수료',
    accounts: [
      { id: 'acc_A60616101', code: 'A60616101', name: '제조비용_지급수수료_검사및측량용역비' },
      { id: 'acc_A60616108', code: 'A60616108', name: '제조비용_지급수수료_기타자문용역비' },
      { id: 'acc_A60616111', code: 'A60616111', name: '제조비용_지급수수료_환경및위생처리용역' },
      { id: 'acc_A60616117', code: 'A60616117', name: '제조비용_지급수수료_특허/공업소유권출원' },
      { id: 'acc_A60616121', code: 'A60616121', name: '제조비용_지급수수료_설계및자료관리용역비' },
      { id: 'acc_A60616129', code: 'A60616129', name: '제조비용_지급수수료_소프트웨어유지보수비' },
      { id: 'acc_A60616199', code: 'A60616199', name: '제조비용_지급수수료_기타' },
    ]
  },
  {
    name: '제조 - 포상비',
    accounts: [
      { id: 'acc_A60617101', code: 'A60617101', name: '제조비용_포상비_표창및상장부상금' },
      { id: 'acc_A60617102', code: 'A60617102', name: '제조비용_포상비_성과및제안포상금' },
      { id: 'acc_A60617199', code: 'A60617199', name: '제조비용_포상비_기타포상비' },
    ]
  },
  {
    name: '제조 - 소모품비',
    accounts: [
      { id: 'acc_A60618101', code: 'A60618101', name: '제조비용_소모품비_사무용품' },
      { id: 'acc_A60618102', code: 'A60618102', name: '제조비용_소모품비_전산용품' },
      { id: 'acc_A60618106', code: 'A60618106', name: '제조비용_소모품비_행사지원비' },
      { id: 'acc_A60618107', code: 'A60618107', name: '제조비용_소모품비_공구와기구' },
      { id: 'acc_A60618199', code: 'A60618199', name: '제조비용_소모품비_기타' },
    ]
  },
  {
    name: '제조 - 피복비',
    accounts: [
      { id: 'acc_A60619101', code: 'A60619101', name: '제조비용_피복비_근무복' },
      { id: 'acc_A60619102', code: 'A60619102', name: '제조비용_피복비_안전피복' },
    ]
  },
  {
    name: '제조 - 도서인쇄비',
    accounts: [
      { id: 'acc_A60620101', code: 'A60620101', name: '제조비용_도서인쇄비_정기간행물구독' },
      { id: 'acc_A60620103', code: 'A60620103', name: '제조비용_도서인쇄비_책자,자료 및 기타 ' },
      { id: 'acc_A60620104', code: 'A60620104', name: '제조비용_도서인쇄비_달력/카드인쇄' },
    ]
  },
  {
    name: '제조 - 차량유지비',
    accounts: [
      { id: 'acc_A60621106', code: 'A60621106', name: '제조비용_차량유지비_수선비' },
      { id: 'acc_A60621107', code: 'A60621107', name: '제조비용_차량유지비_유류비' },
      { id: 'acc_A60621199', code: 'A60621199', name: '제조비용_차량유지비_기타' },
    ]
  },
  {
    name: '제조 - 협회비',
    accounts: [
      { id: 'acc_A60622199', code: 'A60622199', name: '제조비용_협회비_비철강' },
    ]
  },
  {
    name: '제조 - 교육훈련비',
    accounts: [
      { id: 'acc_A60623103', code: 'A60623103', name: '제조비용_교육훈련비_사외위탁' },
      { id: 'acc_A60623104', code: 'A60623104', name: '제조비용_교육훈련비_교육출장' },
      { id: 'acc_A60623105', code: 'A60623105', name: '제조비용_교육훈련비_사외강사료' },
      { id: 'acc_A60623199', code: 'A60623199', name: '제조비용_교육훈련비_기타' },
    ]
  },
  {
    name: '제조 - 회의비',
    accounts: [
      { id: 'acc_A60624101', code: 'A60624101', name: '제조비용_회의비_임원' },
      { id: 'acc_A60624102', code: 'A60624102', name: '제조비용_회의비_일반' },
      { id: 'acc_A60624104', code: 'A60624104', name: '제조비용_회의비_조사업무' },
    ]
  },
  {
    name: '제조 - 환경관리비',
    accounts: [
      { id: 'acc_A60629101', code: 'A60629101', name: '제조비용_환경관리비_환경관리비' },
      { id: 'acc_A60629120', code: 'A60629120', name: '제조비용_환경관리비_보험료' },
      { id: 'acc_A60629123', code: 'A60629123', name: '제조비용_환경관리비_지급수수료' },
      { id: 'acc_A60629125', code: 'A60629125', name: '제조비용_환경관리비_소모품비' },
    ]
  },
  {
    name: '제조 - 안전관리비',
    accounts: [
      { id: 'acc_A60630103', code: 'A60630103', name: '제조비용_안전관리비_안전장구비' },
      { id: 'acc_A60630104', code: 'A60630104', name: '제조비용_안전관리비_안전진단비' },
      { id: 'acc_A60630106', code: 'A60630106', name: '제조비용_안전관리비_안전용역비' },
      { id: 'acc_A60630115', code: 'A60630115', name: '제조비용_안전관리비_여비교통비' },
      { id: 'acc_A60630124', code: 'A60630124', name: '제조비용_안전관리비_수선비' },
      { id: 'acc_A60630125', code: 'A60630125', name: '제조비용_안전관리비_보험료' },
      { id: 'acc_A60630128', code: 'A60630128', name: '제조비용_안전관리비_지급수수료' },
      { id: 'acc_A60630129', code: 'A60630129', name: '제조비용_안전관리비_포상비' },
      { id: 'acc_A60630130', code: 'A60630130', name: '제조비용_안전관리비_소모품비' },
      { id: 'acc_A60630134', code: 'A60630134', name: '제조비용_안전관리비_협회비' },
      { id: 'acc_A60630135', code: 'A60630135', name: '제조비용_안전관리비_교육훈련비' },
      { id: 'acc_A60630136', code: 'A60630136', name: '제조비용_안전관리비_회의비' },
    ]
  },
  {
    name: '제조 - 운반보관비',
    accounts: [
      { id: 'acc_A60631106', code: 'A60631106', name: '제조비용_운반보관비_내수직운송비' },
    ]
  },
  {
    name: '제조 - 품질관리비',
    accounts: [
      { id: 'acc_A60633101', code: 'A60633101', name: '제조비용_품질관리비_품질관리비' },
      { id: 'acc_A60633119', code: 'A60633119', name: '제조비용_품질관리비_수선비' },
      { id: 'acc_A60633123', code: 'A60633123', name: '제조비용_품질관리비_지급수수료' },
      { id: 'acc_A60633125', code: 'A60633125', name: '제조비용_품질관리비_소모품비' },
      { id: 'acc_A60633129', code: 'A60633129', name: '제조비용_품질관리비_협회비' },
      { id: 'acc_A60633131', code: 'A60633131', name: '제조비용_품질관리비_회의비' },
    ]
  },
  {
    name: '판관 - 임원급여',
    accounts: [
      { id: 'acc_B52100101', code: 'B52100101', name: '판관비_임원급여_급여' },
      { id: 'acc_B52100103', code: 'B52100103', name: '판관비_임원급여_임원활동수당' },
      { id: 'acc_B52100105', code: 'B52100105', name: '판관비_임원급여_기타보수' },
      { id: 'acc_B52100112', code: 'B52100112', name: '판관비_임원급여_임원경영성과금' },
    ]
  },
  {
    name: '판관 - 직원급여',
    accounts: [
      { id: 'acc_B52100201', code: 'B52100201', name: '판관비_직원급여_급여' },
      { id: 'acc_B52100202', code: 'B52100202', name: '판관비_직원급여_상여' },
      { id: 'acc_B52100203', code: 'B52100203', name: '판관비_직원급여_시간외수당' },
      { id: 'acc_B52100204', code: 'B52100204', name: '판관비_직원급여_연차수당' },
      { id: 'acc_B52100207', code: 'B52100207', name: '판관비_직원급여_조정수당' },
      { id: 'acc_B52100209', code: 'B52100209', name: '판관비_직원급여_직책수당' },
      { id: 'acc_B52100211', code: 'B52100211', name: '판관비_직원급여_직원경영성과금' },
      { id: 'acc_B52100212', code: 'B52100212', name: '판관비_직원급여_휴일근무수당' },
      { id: 'acc_B52100214', code: 'B52100214', name: '판관비_직원급여_자녀교육비' },
      { id: 'acc_B52100215', code: 'B52100215', name: '판관비_직원급여_주택임차료' },
      { id: 'acc_B52100299', code: 'B52100299', name: '판관비_직원급여_기타수당' },
    ]
  },
  {
    name: '판관 - 퇴직급여충당부채전입액',
    accounts: [
      { id: 'acc_B52110101', code: 'B52110101', name: '판관비_퇴직급여충당부채전입액_사내' },
      { id: 'acc_B52110104', code: 'B52110104', name: '판관비_퇴직급여충당부채전입액_임원' },
    ]
  },
  {
    name: '판관 - 복리후생비',
    accounts: [
      { id: 'acc_B52201101', code: 'B52201101', name: '판관비_복리후생비_건강보험료' },
      { id: 'acc_B52201102', code: 'B52201102', name: '판관비_복리후생비_산재보험료' },
      { id: 'acc_B52201103', code: 'B52201103', name: '판관비_복리후생비_국민연금' },
      { id: 'acc_B52201104', code: 'B52201104', name: '판관비_복리후생비_고용보험료' },
      { id: 'acc_B52201105', code: 'B52201105', name: '판관비_복리후생비_직원중식비' },
      { id: 'acc_B52201115', code: 'B52201115', name: '판관비_복리후생비_보건위생지원' },
      { id: 'acc_B52201116', code: 'B52201116', name: '판관비_복리후생비_사택지원' },
      { id: 'acc_B52201120', code: 'B52201120', name: '판관비_복리후생비_회사출퇴근지원(통근버스)' },
      { id: 'acc_B52201123', code: 'B52201123', name: '판관비_복리후생비_직원간담회지원' },
      { id: 'acc_B52201124', code: 'B52201124', name: '판관비_복리후생비_노경협의회경비' },
      { id: 'acc_B52201125', code: 'B52201125', name: '판관비_복리후생비_노사협력활동지원' },
      { id: 'acc_B52201131', code: 'B52201131', name: '판관비_복리후생비_관람권구입지원' },
      { id: 'acc_B52201150', code: 'B52201150', name: '판관비_복리후생비_식대지원비' },
      { id: 'acc_B52201151', code: 'B52201151', name: '판관비_복리후생비_건강검진비' },
      { id: 'acc_B52201155', code: 'B52201155', name: '판관비_복리후생비_부서별그룹활동지원' },
      { id: 'acc_B52201156', code: 'B52201156', name: '판관비_복리후생비_행사지원비' },
      { id: 'acc_B52201157', code: 'B52201157', name: '판관비_복리후생비_봉사활동지원비' },
      { id: 'acc_B52201158', code: 'B52201158', name: '판관비_복리후생비_차량유류지원비' },
      { id: 'acc_B52201159', code: 'B52201159', name: '판관비_복리후생비_사내경조사비' },
      { id: 'acc_B52201163', code: 'B52201163', name: '판관비_복리후생비_복지카드비용' },
      { id: 'acc_B52201175', code: 'B52201175', name: '판관비_복리후생비_출산장려지원금' },
      { id: 'acc_B52201199', code: 'B52201199', name: '판관비_복리후생비_기타' },
    ]
  },
  {
    name: '판관 - 여비교통비',
    accounts: [
      { id: 'acc_B52202101', code: 'B52202101', name: '판관비_여비교통비_국내여비' },
      { id: 'acc_B52202102', code: 'B52202102', name: '판관비_여비교통비_해외여비' },
    ]
  },
  {
    name: '판관 - 통신비',
    accounts: [
      { id: 'acc_B52203102', code: 'B52203102', name: '판관비_통신비_무선전화사용료' },
      { id: 'acc_B52203104', code: 'B52203104', name: '판관비_통신비_전용선사용료' },
      { id: 'acc_B52203105', code: 'B52203105', name: '판관비_통신비_우편료' },
      { id: 'acc_B52203106', code: 'B52203106', name: '판관비_통신비_인터넷사용료' },
      { id: 'acc_B52203199', code: 'B52203199', name: '판관비_통신비_기타' },
    ]
  },
  {
    name: '판관 - 용수비',
    accounts: [
      { id: 'acc_B52205101', code: 'B52205101', name: '판관비_용수비' },
    ]
  },
  {
    name: '판관 - 연료유지비',
    accounts: [
      { id: 'acc_B52206101', code: 'B52206101', name: '판관비_연료유지비' },
    ]
  },
  {
    name: '판관 - 세금과공과',
    accounts: [
      { id: 'acc_B52207101', code: 'B52207101', name: '판관비_세금과공과_종업원할사업소세' },
      { id: 'acc_B52207102', code: 'B52207102', name: '판관비_세금과공과_재산할사업소세' },
      { id: 'acc_B52207103', code: 'B52207103', name: '판관비_세금과공과_재산세_건물분' },
      { id: 'acc_B52207104', code: 'B52207104', name: '판관비_세금과공과_재산세_토지분' },
      { id: 'acc_B52207105', code: 'B52207105', name: '판관비_세금과공과_주민세' },
      { id: 'acc_B52207106', code: 'B52207106', name: '판관비_세금과공과_면허세' },
      { id: 'acc_B52207108', code: 'B52207108', name: '판관비_세금과공과_수입인지대' },
      { id: 'acc_B52207111', code: 'B52207111', name: '판관비_세금과공과_자동차세' },
      { id: 'acc_B52207112', code: 'B52207112', name: '제조비용_세금과공과_면허세' },
      { id: 'acc_B52207199', code: 'B52207199', name: '판관비_세금과공과_기타' },
    ]
  },
  {
    name: '판관 - 감가상각비',
    accounts: [
      { id: 'acc_B52208101', code: 'B52208101', name: '판관비_유형자산 감가상각비' },
      { id: 'acc_B52208202', code: 'B52208202', name: '판관비_무형자산 감가상각비' },
      { id: 'acc_B52208303', code: 'B52208303', name: '판관비_투자부동산감가상각비' },
      { id: 'acc_B52208504', code: 'B52208504', name: '판관비_사용권자산감가상각비_건물 및 구축물' },
      { id: 'acc_B52208506', code: 'B52208506', name: '판관비_사용권자산감가상각비_차량운반구' },
    ]
  },
  {
    name: '판관 - 지급임차료',
    accounts: [
      { id: 'acc_B52209101', code: 'B52209101', name: '판관비_지급임차료_차량임차료' },
      { id: 'acc_B52209103', code: 'B52209103', name: '판관비_지급임차료_주택및숙소임차료' },
      { id: 'acc_B52209108', code: 'B52209108', name: '판관비_지급임차료_보세장치장/창고사용료' },
      { id: 'acc_B52209111', code: 'B52209111', name: '판관비_지급임차료_사무용기기임차료' },
      { id: 'acc_B52209112', code: 'B52209112', name: '판관비_지급임차료_중장비임차료' },
      { id: 'acc_B52209199', code: 'B52209199', name: '판관비_지급임차료_기타' },
    ]
  },
  {
    name: '판관 - 수선비',
    accounts: [
      { id: 'acc_B52210117', code: 'B52210117', name: '판관비_수선비_정보통신' },
      { id: 'acc_B52210199', code: 'B52210199', name: '판관비_수선비_기타' },
    ]
  },
  {
    name: '판관 - 보험료',
    accounts: [
      { id: 'acc_B52211101', code: 'B52211101', name: '판관비_보험료_화재및기계기관' },
      { id: 'acc_B52211102', code: 'B52211102', name: '판관비_보험료_종업원재해보장' },
      { id: 'acc_B52211108', code: 'B52211108', name: '판관비_보험료_이행보험료' },
      { id: 'acc_B52211110', code: 'B52211110', name: '판관비_보험료_보증보험료' },
      { id: 'acc_B52211199', code: 'B52211199', name: '판관비_보험료_기타' },
    ]
  },
  {
    name: '판관 - 업무추진비',
    accounts: [
      { id: 'acc_B52212101', code: 'B52212101', name: '판관비_업무추진비_임원접대비' },
      { id: 'acc_B52212102', code: 'B52212102', name: '판관비_업무추진비_일반접대비' },
      { id: 'acc_B52212103', code: 'B52212103', name: '판관비_업무추진비_임원경조사비' },
      { id: 'acc_B52212199', code: 'B52212199', name: '판관비_업무추진비_기타' },
    ]
  },
  {
    name: '판관 - 광고선전비',
    accounts: [
      { id: 'acc_B52213101', code: 'B52213101', name: '판관비_광고선전비_신문광고' },
      { id: 'acc_B52213106', code: 'B52213106', name: '판관비_광고선전비_홍보물제작' },
      { id: 'acc_B52213107', code: 'B52213107', name: '판관비_광고선전비_지역협력홍보' },
    ]
  },
  {
    name: '판관 - 지급수수료',
    accounts: [
      { id: 'acc_B52216101', code: 'B52216101', name: '판관비_지급수수료_검사및측량용역비' },
      { id: 'acc_B52216104', code: 'B52216104', name: '판관비_지급수수료_재무자문용역' },
      { id: 'acc_B52216105', code: 'B52216105', name: '판관비_지급수수료_법률자문용역' },
      { id: 'acc_B52216108', code: 'B52216108', name: '판관비_지급수수료_기타자문용역비' },
      { id: 'acc_B52216109', code: 'B52216109', name: '판관비_지급수수료_전산운영용역비' },
      { id: 'acc_B52216110', code: 'B52216110', name: '판관비_지급수수료_전산개발용역비' },
      { id: 'acc_B52216112', code: 'B52216112', name: '판관비_지급수수료_금융기관수수료' },
      { id: 'acc_B52216113', code: 'B52216113', name: '판관비_지급수수료_신용평가수수료' },
      { id: 'acc_B52216117', code: 'B52216117', name: '판관비_지급수수료_특허/공업소유권출원' },
      { id: 'acc_B52216126', code: 'B52216126', name: '판관비_지급수수료_건물관리용역비' },
      { id: 'acc_B52216129', code: 'B52216129', name: '판관비_지급수수료_소프트웨어유지보수비' },
      { id: 'acc_B52216130', code: 'B52216130', name: '판관비_지급수수료_입찰관련 용역비' },
      { id: 'acc_B52216131', code: 'B52216131', name: '판관비_지급수수료_번역수수료' },
      { id: 'acc_B52216132', code: 'B52216132', name: '판관비_지급수수료_제증명발급수수료' },
      { id: 'acc_B52216133', code: 'B52216133', name: '판관비_지급수수료_채용수수료' },
      { id: 'acc_B52216134', code: 'B52216134', name: '판관비_지급수수료_전산기기유지보수료' },
      { id: 'acc_B52216137', code: 'B52216137', name: '판관비_지급수수료_담보설정수수료' },
      { id: 'acc_B52216138', code: 'B52216138', name: '판관비_지급수수료_경영관리비' },
      { id: 'acc_B52216199', code: 'B52216199', name: '판관비_지급수수료_기타' },
    ]
  },
  {
    name: '판관 - 포상비',
    accounts: [
      { id: 'acc_B52217101', code: 'B52217101', name: '판관비_포상비_표창및상장부상금' },
      { id: 'acc_B52217102', code: 'B52217102', name: '판관비_포상비_성과및제안포상금' },
      { id: 'acc_B52217199', code: 'B52217199', name: '판관비_포상비_기타포상비' },
    ]
  },
  {
    name: '판관 - 소모품비',
    accounts: [
      { id: 'acc_B52218101', code: 'B52218101', name: '판관비_소모품비_사무용품' },
      { id: 'acc_B52218102', code: 'B52218102', name: '판관비_소모품비_전산용품' },
      { id: 'acc_B52218106', code: 'B52218106', name: '판관비_소모품비_행사지원비' },
      { id: 'acc_B52218107', code: 'B52218107', name: '판관비_소모품비_공구와기구' },
      { id: 'acc_B52218199', code: 'B52218199', name: '판관비_소모품비_기타' },
    ]
  },
  {
    name: '판관 - 피복비',
    accounts: [
      { id: 'acc_B52219101', code: 'B52219101', name: '판관비_피복비_근무복' },
      { id: 'acc_B52219102', code: 'B52219102', name: '판관비_피복비_안전피복' },
    ]
  },
  {
    name: '판관 - 도서인쇄비',
    accounts: [
      { id: 'acc_B52220101', code: 'B52220101', name: '판관비_도서인쇄비_정기간행물구독' },
      { id: 'acc_B52220102', code: 'B52220102', name: '판관비_도서인쇄비_단행본구입' },
      { id: 'acc_B52220103', code: 'B52220103', name: '판관비_도서인쇄비_책자,자료 및 기타' },
      { id: 'acc_B52220104', code: 'B52220104', name: '판관비_도서인쇄비_달력/카드인쇄' },
    ]
  },
  {
    name: '판관 - 차량유지비',
    accounts: [
      { id: 'acc_B52221106', code: 'B52221106', name: '판관비_차량유지비_수선비' },
      { id: 'acc_B52221107', code: 'B52221107', name: '판관비_차량유지비_유류비' },
      { id: 'acc_B52221199', code: 'B52221199', name: '판관비_차량유지비_기타' },
    ]
  },
  {
    name: '판관 - 협회비',
    accounts: [
      { id: 'acc_B52222199', code: 'B52222199', name: '판관비_협회비_비철강' },
    ]
  },
  {
    name: '판관 - 교육훈련비',
    accounts: [
      { id: 'acc_B52223103', code: 'B52223103', name: '판관비_교육훈련비_사외위탁' },
      { id: 'acc_B52223104', code: 'B52223104', name: '판관비_교육훈련비_교육출장' },
      { id: 'acc_B52223105', code: 'B52223105', name: '판관비_교육훈련비_사외강사료' },
      { id: 'acc_B52223121', code: 'B52223121', name: '판관비_교육훈련비_위탁용역교육비' },
      { id: 'acc_B52223199', code: 'B52223199', name: '판관비_교육훈련비_기타' },
    ]
  },
  {
    name: '판관 - 회의비',
    accounts: [
      { id: 'acc_B52224101', code: 'B52224101', name: '판관비_회의비_임원' },
      { id: 'acc_B52224102', code: 'B52224102', name: '판관비_회의비_일반' },
      { id: 'acc_B52224103', code: 'B52224103', name: '판관비_회의비_지역협력' },
      { id: 'acc_B52224104', code: 'B52224104', name: '판관비_회의비_조사업무' },
    ]
  },
  {
    name: '판관 - 운반보관비',
    accounts: [
      { id: 'acc_B52310101', code: 'B52310101', name: '판관비_운반보관비_수출해송운임' },
      { id: 'acc_B52310106', code: 'B52310106', name: '판관비_운반보관비_내수직운송비' },
    ]
  },
  {
    name: '판관 - 판매수수료',
    accounts: [
      { id: 'acc_B52330104', code: 'B52330104', name: '판관비_판매수수료_기타자문용역' },
      { id: 'acc_B52330109', code: 'B52330109', name: '판관비_판매수수료_클레임관련비용' },
      { id: 'acc_B52330111', code: 'B52330111', name: '판관비_판매수수료_통관수수료' },
      { id: 'acc_B52330199', code: 'B52330199', name: '판관비_판매수수료_기타' },
    ]
  },
  {
    name: '판관 - 판매촉진비',
    accounts: [
      { id: 'acc_B52350104', code: 'B52350104', name: '판관비_판매촉진비_일반업무추진비' },
    ]
  },
  {
    name: '판관 - 견본비',
    accounts: [
      { id: 'acc_B52360101', code: 'B52360101', name: '판관비_견본비' },
    ]
  },
  {
    name: '판관 - 판매보험료',
    accounts: [
      { id: 'acc_B52370302', code: 'B52370302', name: '판관비_판매보험료_판매보증보험료' },
      { id: 'acc_B52370303', code: 'B52370303', name: '판관비_판매보험료_수출보험료' },
    ]
  },
  {
    name: '판관 - 기타판매비',
    accounts: [
      { id: 'acc_B52900101', code: 'B52900101', name: '판관비_기타판매비' },
    ]
  },
  {
    name: '투자 - 투자',
    accounts: [
      { id: 'acc_12310000', code: '12310000', name: '토지' },
      { id: 'acc_12320000', code: '12320000', name: '건물' },
      { id: 'acc_12330000', code: '12330000', name: '구축물' },
      { id: 'acc_12340000', code: '12340000', name: '기계장치' },
      { id: 'acc_12360000', code: '12360000', name: '공구와기구' },
      { id: 'acc_12370000', code: '12370000', name: '비품' },
      { id: 'acc_12390000', code: '12390000', name: '건설중인자산' },
      { id: 'acc_12480000', code: '12480000', name: '기타무형자산' },
      { id: 'acc_12480200', code: '12480200', name: '소프트웨어' },
      { id: 'acc_12107401', code: '12107401', name: '임차보증금' },
    ]
  }
];

export default function AccountSelection() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [selectedDeptCode, setSelectedDeptCode] = useState(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      const viewable = getViewableDepts(user.code);
      return viewable.length > 0 ? viewable[0].code : '';
    }
    return '';
  });
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState('ALL');
  const [deptSelections, setDeptSelections] = useState<Record<string, Set<string>>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRegroupModalOpen, setIsRegroupModalOpen] = useState(false);
  // [과제 3: 신규 '계정 이동' 모달 및 전사 데이터 연동] - 계정 이동 모달 상태
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState('');
  const [selectedSuffix, setSelectedSuffix] = useState('');
  
  // 계정 코드 유효성 검사 (A 또는 B 포함 여부)
  const isCodeValid = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    return trimmed.includes('A') || trimmed.includes('B');
  };
  
  const isAddButtonDisabled = !newAccountCode.trim() || !newAccountName.trim() || !selectedPrefix || !selectedSuffix || !isCodeValid(newAccountCode);

  // [과제 3: 신규 '계정 이동' 모달 및 전사 데이터 연동] - 이동할 대상 카테고리 상태
  const [selectedTargetCategory, setSelectedTargetCategory] = useState('');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', message: '' });

  const showAlert = (message: string) => {
    setModalConfig({ isOpen: true, type: 'alert', message });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Handle Enter key for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (modalConfig.isOpen) {
          if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
            modalConfig.onConfirm();
          }
          closeModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedAccounts = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
    const savedUser = localStorage.getItem('current_user');
    const user = savedUser ? JSON.parse(savedUser) : null;
    
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    const userSetting = user ? settings[user.code] : null;
    const hasSalaryAccess = (user?.code === '99999' || user?.code === '32100') || (userSetting?.hasSalaryAccess ?? false);

    // Create a deep copy to avoid mutating INITIAL_CATEGORIES
    let baseCategories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    
    if (savedAccounts) {
      try {
        const parsed = JSON.parse(savedAccounts);
        if (Array.isArray(parsed)) {
          baseCategories = parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved accounts', e);
      }
    }

    if (!hasSalaryAccess) {
      baseCategories = baseCategories.filter(cat => !SALARY_CATEGORIES.includes(cat.name));
    } else if (savedAccounts) {
      // If we have salary access but salary categories are missing from saved data, restore them
      SALARY_CATEGORIES.forEach(salaryCatName => {
        if (!baseCategories.some(cat => cat.name === salaryCatName)) {
          const initialCat = INITIAL_CATEGORIES.find(c => c.name === salaryCatName);
          if (initialCat) {
            baseCategories.push(JSON.parse(JSON.stringify(initialCat)));
          }
        }
      });
    }

    // Deduplicate accounts within categories just in case
    baseCategories.forEach(cat => {
      const seenCodes = new Set();
      cat.accounts = cat.accounts.filter(acc => {
        if (seenCodes.has(acc.code)) return false;
        seenCodes.add(acc.code);
        return true;
      });
    });

    setCategories(baseCategories);

    const savedSelections = localStorage.getItem(STORAGE_KEYS.DEPT_SELECTIONS);
    if (savedSelections) {
      const parsed = JSON.parse(savedSelections);
      const newSelections: Record<string, Set<string>> = {};
      Object.keys(parsed).forEach(key => {
        newSelections[key] = new Set(parsed[key]);
      });
      setDeptSelections(newSelections);
    }
  }, []);

  const allDepts = getAllDepartments();
  const isOperator = currentUser?.code === '99999';
  const isFinanceManager = currentUser?.code === '32100';
  // [과제 1: 버튼 권한 분리 및 UI 재배치] - 마스터 계정 권한 확인 로직
  const canManageAccounts = isOperator || isFinanceManager;
  
  let viewableDepts = currentUser ? getViewableDepts(currentUser.code) : [];
  if (canManageAccounts) {
    viewableDepts = allDepts;
  }

  const currentDept = allDepts.find(d => d.code === selectedDeptCode) || (allDepts.length > 0 ? allDepts[0] : null);
  
  const currentSelected = deptSelections[selectedDeptCode] || new Set();

  const toggleAccount = (id: string) => {
    const newSelected = new Set(currentSelected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    
    setDeptSelections({
      ...deptSelections,
      [selectedDeptCode]: newSelected
    });
  };

  const toggleCategorySelection = (category: any) => {
    const newSelected = new Set(currentSelected);
    const allIds = category.accounts.map((a: any) => a.id);
    const allSelected = allIds.every((id: string) => newSelected.has(id));

    if (allSelected) {
      allIds.forEach((id: string) => newSelected.delete(id));
    } else {
      allIds.forEach((id: string) => newSelected.add(id));
    }

    setDeptSelections({
      ...deptSelections,
      [selectedDeptCode]: newSelected
    });
  };

  const toggleCategoryCollapse = (categoryName: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryName)) {
      newCollapsed.delete(categoryName);
    } else {
      newCollapsed.add(categoryName);
    }
    setCollapsedCategories(newCollapsed);
  };

  const toggleAllCollapse = () => {
    if (collapsedCategories.size === filteredCategories.length) {
      setCollapsedCategories(new Set());
    } else {
      setCollapsedCategories(new Set(filteredCategories.map(c => c.name)));
    }
  };

  const extractCategoryFromName = (name: string) => {
    if (name.includes('_')) {
      const parts = name.split('_');
      if (parts.length >= 3) return parts[1];
      return parts[0];
    }
    
    // 급여 관련 계정 정밀 분류
    const isMfg = name.includes('제조') || name.includes('(제)');
    const isSga = name.includes('판관') || name.includes('관리') || name.includes('(판)');
    
    if (name.includes('급여') || name.includes('상여') || name.includes('수당')) {
      if (name.includes('임원')) {
        return isSga ? '판관 - 임원급여' : '제조 - 임원급여';
      }
      if (name.includes('퇴직')) {
        return isSga ? '판관 - 퇴직급여충당부채전입액' : '제조 - 퇴직급여충당부채전입액';
      }
      return isSga ? '판관 - 직원급여' : '제조 - 직원급여';
    }
    
    if (name.includes('복리') || name.includes('식대') || name.includes('교통')) return '복리후생비';
    if (name.includes('통신') || name.includes('우편')) return '통신비';
    if (name.includes('소모품') || name.includes('비품')) return '소모품비';
    if (name.includes('수수료') || name.includes('지급')) return '지급수수료';
    return '기타';
  };

  const processExcelData = (rows: any[][]) => {
    if (!canManageAccounts) {
      showAlert('운영자 및 기획재무그룹 관리자만 전사 계정을 추가할 수 있습니다.');
      return;
    }

    const newCategories = [...categories];
    let addedCount = 0;
    let duplicateCount = 0;
    const newlyAddedIds: string[] = [];

    rows.forEach(row => {
      if (row.length >= 2) {
        const code = String(row[0]).trim();
        const name = String(row[1]).trim();

        if (!code || !name || code === '계정코드' || name === '계정명') return;

        const numCount = code.replace(/[^0-9]/g, '').length;
        if (numCount > 8) return;

        let foundAccount = null;
        for (const cat of newCategories) {
          const acc = cat.accounts.find(a => a.code === code);
          if (acc) {
            foundAccount = acc;
            break;
          }
        }

        if (!foundAccount) {
          const combinedCategory = (selectedPrefix && selectedSuffix) ? `${selectedPrefix} - ${selectedSuffix}` : '';
          const autoCategoryName = combinedCategory || extractCategoryFromName(name);
          
          let targetCat = newCategories.find(c => c.name === autoCategoryName);
          if (!targetCat) {
            targetCat = { name: autoCategoryName, accounts: [] };
            newCategories.push(targetCat);
          }
          
          const newId = `acc_${code}_${Date.now()}`;
          foundAccount = { id: newId, code, name };
          targetCat.accounts.push(foundAccount);
          newlyAddedIds.push(newId);
          addedCount++;
        } else {
          duplicateCount++;
        }
      }
    });

    setCategories(newCategories);
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACCOUNTS, JSON.stringify(newCategories));

    if (newlyAddedIds.length > 0) {
      const newDeptSelections = { ...deptSelections };
      viewableDepts.forEach(dept => {
        const newSelected = new Set(newDeptSelections[dept.code] || []);
        newlyAddedIds.forEach(id => newSelected.add(id));
        newDeptSelections[dept.code] = newSelected;
      });
      setDeptSelections(newDeptSelections);
      
      const serializedSelections: Record<string, string[]> = {};
      Object.keys(newDeptSelections).forEach(key => {
        serializedSelections[key] = Array.from(newDeptSelections[key]);
      });
      localStorage.setItem(STORAGE_KEYS.DEPT_SELECTIONS, JSON.stringify(serializedSelections));
    }

    if (addedCount > 0 || duplicateCount > 0) {
      showAlert(`${addedCount}개의 새로운 계정이 추가되었고, ${duplicateCount}개의 중복 계정은 제외되었습니다. (새 계정은 권한이 있는 모든 부서에 자동 선택됨)`);
    } else {
      showAlert('처리 완료: 이미 존재하는 계정들입니다.');
    }
  };

  const handleAddAccount = () => {
    const selectedCategory = `${selectedPrefix} - ${selectedSuffix}`;
    if (!newAccountCode.trim() || !newAccountName.trim() || !selectedPrefix || !selectedSuffix) {
      showAlert('계정 코드, 계정명, 소속 그룹을 모두 입력/선택해주세요.');
      return;
    }

    const numCount = newAccountCode.replace(/[^0-9]/g, '').length;
    if (numCount > 8) {
      showAlert('계정코드의 숫자는 8자리를 초과할 수 없습니다.');
      return;
    }

    const newCategories = [...categories];
    const targetCategoryIndex = newCategories.findIndex(c => c.name === selectedCategory);
    
    if (targetCategoryIndex === -1) {
      showAlert('선택한 그룹을 찾을 수 없습니다.');
      return;
    }

    // New validation rules
    const trimmedCode = newAccountCode.trim().toUpperCase();
    if (selectedCategory.startsWith('제조') && trimmedCode.startsWith('B')) {
      showAlert('제조 그룹에는 B로 시작하는 계정코드를 추가할 수 없습니다.');
      return;
    }
    if (selectedCategory.startsWith('판관') && trimmedCode.startsWith('A')) {
      showAlert('판관 그룹에는 A로 시작하는 계정코드를 추가할 수 없습니다.');
      return;
    }

    const accountExists = newCategories.some(cat => 
      cat.accounts.some(acc => acc.code === newAccountCode.trim())
    );

    if (accountExists) {
      showAlert('이미 존재하는 계정 코드입니다.');
      return;
    }

    const newAccountId = `acc_${newAccountCode.trim()}_${Date.now()}`;
    newCategories[targetCategoryIndex].accounts.push({
      id: newAccountId,
      code: newAccountCode.trim(),
      name: newAccountName.trim()
    });

    setCategories(newCategories);
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACCOUNTS, JSON.stringify(newCategories));
    
    // Auto-select for all viewable departments
    const newDeptSelections = { ...deptSelections };
    viewableDepts.forEach(dept => {
      const newSelected = new Set(newDeptSelections[dept.code] || []);
      newSelected.add(newAccountId);
      newDeptSelections[dept.code] = newSelected;
    });
    setDeptSelections(newDeptSelections);
    
    const serializedSelections: Record<string, string[]> = {};
    Object.keys(newDeptSelections).forEach(key => {
      serializedSelections[key] = Array.from(newDeptSelections[key]);
    });
    localStorage.setItem(STORAGE_KEYS.DEPT_SELECTIONS, JSON.stringify(serializedSelections));
    
    showAlert('새로운 계정이 추가되었으며, 권한이 있는 모든 부서에 자동 선택되었습니다.');
    setIsAddModalOpen(false);
    setNewAccountCode('');
    setNewAccountName('');
    setSelectedPrefix('');
    setSelectedSuffix('');
  };

  // [과제 3: 신규 '계정 이동' 모달 및 전사 데이터 연동] - 계정 이동 로직
  const handleMoveAccounts = () => {
    if (!canManageAccounts) {
      showAlert('운영자 및 기획재무그룹 관리자만 계정을 이동할 수 있습니다.');
      return;
    }

    if (currentSelected.size === 0) {
      showAlert('이동할 계정을 선택해주세요.');
      return;
    }

    if (!selectedTargetCategory) {
      showAlert('이동할 소속 그룹을 선택해주세요.');
      return;
    }

    const newCategories = JSON.parse(JSON.stringify(categories));
    const targetCategory = newCategories.find((c: any) => c.name === selectedTargetCategory);
    
    if (!targetCategory) {
      showAlert('선택한 그룹을 찾을 수 없습니다.');
      return;
    }

    const accountsToMove: any[] = [];
    newCategories.forEach((cat: any) => {
      cat.accounts = cat.accounts.filter((acc: any) => {
        if (currentSelected.has(acc.id)) {
          accountsToMove.push(acc);
          return false;
        }
        return true;
      });
    });

    targetCategory.accounts.push(...accountsToMove);

    // Remove empty categories if they are not the target
    const finalCategories = newCategories.filter((cat: any) => cat.accounts.length > 0 || cat.name === selectedTargetCategory);

    setCategories(finalCategories);
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACCOUNTS, JSON.stringify(finalCategories));
    
    showAlert('계정이 성공적으로 이동되었습니다.');
    setIsMoveModalOpen(false);
    setSelectedTargetCategory('');
  };

  // [과제 2: 멈춰버린 '계정 저장' 및 '계정 삭제' 로직 복구] - 계정 삭제
  const handleDeleteAccounts = () => {
    if (!canManageAccounts) {
      showAlert('운영자 및 기획재무그룹 관리자만 계정을 삭제할 수 있습니다.');
      return;
    }

    if (currentSelected.size === 0) {
      showAlert('삭제할 계정을 선택해주세요.');
      return;
    }

    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAccounts = () => {
    const newCategories = categories.map(cat => ({
      ...cat,
      accounts: cat.accounts.filter(acc => !currentSelected.has(acc.id))
    })).filter(cat => cat.accounts.length > 0);

    setCategories(newCategories);
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACCOUNTS, JSON.stringify(newCategories));
    
    const newDeptSelections = { ...deptSelections };
    Object.keys(newDeptSelections).forEach(deptCode => {
      const selections = new Set(newDeptSelections[deptCode]);
      currentSelected.forEach(id => selections.delete(id));
      newDeptSelections[deptCode] = selections;
    });
    setDeptSelections(newDeptSelections);
    
    const serializedSelections: Record<string, string[]> = {};
    Object.keys(newDeptSelections).forEach(key => {
      serializedSelections[key] = Array.from(newDeptSelections[key]);
    });
    localStorage.setItem(STORAGE_KEYS.DEPT_SELECTIONS, JSON.stringify(serializedSelections));

    setIsDeleteModalOpen(false);
    showAlert('선택한 계정이 삭제되었습니다.');
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;

    const rows = clipboardData
      .split(/\r?\n/)
      .filter(row => row.trim() !== '')
      .map(row => row.split('\t'));
      
    processExcelData(rows);
    setNewAccountCode('');
    setNewAccountName('');
  };

  const handleRegroupAccounts = () => {
    setIsRegroupModalOpen(true);
  };

  const confirmRegroupAccounts = () => {
    const allAccounts: any[] = [];
    categories.forEach(cat => {
      cat.accounts.forEach(acc => {
        // Fix missing code for accounts added previously
        if (!acc.code) {
          // Try to extract code from id (e.g. acc_A60629130_12345)
          const match = acc.id?.match(/^acc_([A-Z0-9]+)_/);
          if (match) {
            acc.code = match[1];
          } else {
            acc.code = acc.id; // Fallback
          }
        }
        allAccounts.push(acc);
      });
    });

    // Remove duplicates based on code
    const uniqueAccounts = Array.from(new Map(allAccounts.map(item => [item.code, item])).values());

    const regroupedCategories = INITIAL_CATEGORIES.map(cat => ({
      name: cat.name,
      accounts: [] as any[]
    }));

    uniqueAccounts.forEach(acc => {
      const autoCategoryName = extractCategoryFromName(acc.name);
      let targetCat = regroupedCategories.find(c => c.name === autoCategoryName);
      
      if (!targetCat) {
        targetCat = { name: autoCategoryName, accounts: [] };
        regroupedCategories.push(targetCat);
      }
      
      targetCat.accounts.push(acc);
    });

    setCategories(regroupedCategories);
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACCOUNTS, JSON.stringify(regroupedCategories));
    setIsRegroupModalOpen(false);
    showAlert('모든 계정이 성공적으로 재그룹화되었습니다.');
  };

  // [과제 2: 멈춰버린 '계정 저장' 및 '계정 삭제' 로직 복구] - 계정 저장
  const handleSave = () => {
    const serializedSelections: Record<string, string[]> = {};
    Object.keys(deptSelections).forEach(key => {
      serializedSelections[key] = Array.from(deptSelections[key]);
    });
    localStorage.setItem(STORAGE_KEYS.DEPT_SELECTIONS, JSON.stringify(serializedSelections));
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACCOUNTS, JSON.stringify(categories));
    showAlert('저장되었습니다.');
  };

  const filteredCategories = categories
    .filter(category => {
      let passCategory = true;
      if (categoryFilter === '제조') passCategory = category.name.startsWith('제조');
      else if (categoryFilter === '판관') passCategory = category.name.startsWith('판관');
      
      if (!passCategory) return false;

      if (subCategoryFilter !== 'ALL') {
        const subName = category.name.split(' - ')[1] || category.name;
        if (subName !== subCategoryFilter) return false;
      }
      
      return true;
    })
    .map(category => ({
      ...category,
      accounts: category.accounts.filter(acc => 
        acc.name.includes(searchTerm) || acc.code.includes(searchTerm)
      )
    }))
    .filter(category => category.accounts.length > 0)
    .sort((a, b) => {
      // Sort by the code of the first account in each category
      const codeA = a.accounts[0]?.code || '';
      const codeB = b.accounts[0]?.code || '';
      return codeA.localeCompare(codeB);
    });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-lithium-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-eco-black">전사 예산 계정 관리 및 부서별 선택</h2>
            <p className="text-lithium-600 mt-2">
              운영자는 전사 계정을 추가하고, 각 부서는<br />
              필요한 계정을 선택하여 예산을 작성합니다.
            </p>
          </div>
          
          <div className="flex flex-col gap-2 items-end w-full md:w-auto">
            <div className="flex flex-wrap gap-2 w-full justify-end">
              {/* [과제 1: 버튼 권한 분리 및 UI 재배치] - 마스터 권한에 따른 버튼 렌더링 조건 설정 */}
              {canManageAccounts && (
                <>
                  <button 
                    onClick={() => {
                      setNewAccountCode('');
                      setNewAccountName('');
                      setSelectedPrefix('');
                      setSelectedSuffix('');
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center px-4 py-2 bg-white border border-lithium-300 text-lithium-600 rounded-xl text-sm font-medium hover:bg-lithium-50 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    계정 추가
                  </button>
                  <button 
                    onClick={handleDeleteAccounts}
                    className="flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    계정 삭제
                  </button>
                  {/* [과제 1: 버튼 권한 분리 및 UI 재배치] - 계정 이동 버튼 아이콘 변경 (ArrowRightLeft) */}
                  <button 
                    onClick={() => {
                      if (currentSelected.size === 0) {
                        showAlert('이동할 계정을 선택해주세요.');
                        return;
                      }
                      setIsMoveModalOpen(true);
                    }}
                    className="flex items-center px-4 py-2 bg-white border border-lithium-300 text-lithium-600 rounded-xl text-sm font-medium hover:bg-lithium-50 transition-colors"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    계정 이동
                  </button>
                </>
              )}
              {/* [과제 1: 버튼 권한 분리 및 UI 재배치] - 계정 저장 버튼 이름 및 UI 밸런스 조정 */}
              <button 
                onClick={handleSave}
                className="flex items-center px-4 py-2 bg-nickel-600 text-white rounded-xl text-sm font-medium hover:bg-nickel-700 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                계정 저장
              </button>
            </div>
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="flex flex-col sm:flex-row items-center mb-8 gap-4">
          <div className="flex items-center w-full sm:w-1/3">
            <Building2 className="w-5 h-5 text-lithium-500 mr-3 flex-shrink-0" />
            <div className="relative flex-1">
              <select
                value={selectedDeptCode}
                onChange={(e) => setSelectedDeptCode(e.target.value)}
                className="block w-full pl-4 pr-10 py-2.5 text-sm border border-lithium-300 focus:outline-none focus:ring-2 focus:ring-nickel-500 focus:border-nickel-500 rounded-xl bg-white text-eco-black font-medium appearance-none cursor-pointer"
              >
                {viewableDepts.map(dept => (
                  <option key={dept.code} value={dept.code}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-lithium-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="relative w-full sm:w-1/3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full pl-4 pr-10 py-2.5 text-sm border border-lithium-300 focus:outline-none focus:ring-2 focus:ring-nickel-500 focus:border-nickel-500 rounded-xl bg-white text-eco-black font-medium appearance-none cursor-pointer"
            >
              <option value="ALL">전체 (제조/판관)</option>
              <option value="제조">제조</option>
              <option value="판관">판관</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-lithium-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative w-full sm:w-1/3">
            <select
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              className="block w-full pl-4 pr-10 py-2.5 text-sm border border-lithium-300 focus:outline-none focus:ring-2 focus:ring-nickel-500 focus:border-nickel-500 rounded-xl bg-white text-eco-black font-medium appearance-none cursor-pointer"
            >
              <option value="ALL">전체 분류</option>
              {Array.from(new Set(categories.map(c => c.name.split(' - ')[1] || c.name))).map(subName => (
                <option key={subName} value={subName}>{subName}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-lithium-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
          현재 <strong>{currentDept.name} ({currentDept.manager})</strong>의 예산 계정을 선택 중입니다. 선택한 계정만 예산 작성 페이지에 표시됩니다.
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-lithium-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 border border-lithium-300 rounded-xl text-eco-black placeholder-lithium-500 focus:outline-none focus:ring-2 focus:ring-nickel-500 focus:border-transparent transition-shadow"
              placeholder="계정명 또는 코드 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={toggleAllCollapse}
            className="ml-4 px-4 py-3 bg-lithium-100 text-lithium-600 rounded-xl text-sm font-bold hover:bg-lithium-200 transition-colors flex items-center whitespace-nowrap"
          >
            {collapsedCategories.size === filteredCategories.length ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
            {collapsedCategories.size === filteredCategories.length ? '모두 펼치기' : '모두 접기'}
          </button>
        </div>

        <div className="space-y-8">
          {filteredCategories.map((category) => {
            const isCollapsed = collapsedCategories.has(category.name);
            const allSelected = category.accounts.every(acc => currentSelected.has(acc.id));
            const someSelected = category.accounts.some(acc => currentSelected.has(acc.id));
            
            return (
              <div key={category.name} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-lithium-200">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCategoryCollapse(category.name)}
                      className="flex items-center justify-center w-6 h-6 rounded bg-white border border-lithium-300 text-lithium-600 hover:bg-lithium-100 transition-colors"
                    >
                      {isCollapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    </button>
                    <div 
                      onClick={() => toggleCategorySelection(category)}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        allSelected 
                          ? 'bg-nickel-600 border-nickel-600' 
                          : someSelected 
                            ? 'bg-nickel-100 border-nickel-300' 
                            : 'border-lithium-300 group-hover:border-nickel-400'
                      }`}>
                        {allSelected ? (
                          <Check className="w-3 h-3 text-white" />
                        ) : someSelected ? (
                          <div className="w-2 h-0.5 bg-nickel-600" />
                        ) : null}
                      </div>
                      <h3 className="text-lg font-bold text-eco-black group-hover:text-nickel-600 transition-colors">{category.name}</h3>
                    </div>
                    <span className="text-xs text-lithium-500 font-medium">({category.accounts.length}개)</span>
                  </div>
                </div>
                
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {category.accounts.map((account, index) => {
                      const isSelected = currentSelected.has(account.id);
                      return (
                        <div
                          key={`${account.code}_${category.name}_${index}`}
                          onClick={() => toggleAccount(account.id)}
                          className={`relative flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-nickel-600 bg-nickel-50' 
                              : 'border-lithium-200 bg-white hover:border-lithium-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                            isSelected ? 'bg-nickel-600 border-nickel-600' : 'border-lithium-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${isSelected ? 'text-nickel-700' : 'text-eco-black'}`}>
                              {account.name}
                            </p>
                            <p className={`text-xs mt-0.5 ${isSelected ? 'text-nickel-600' : 'text-lithium-500'}`}>
                              {account.code}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredCategories.length === 0 && (
            <div className="text-center py-12 text-lithium-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>

      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onPaste={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-lithium-200 flex justify-between items-center bg-lithium-50">
              <h3 className="text-lg font-bold text-eco-black">계정 추가</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-lithium-500 hover:text-eco-black transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-lithium-600 mb-1">구분</label>
                  <select
                    value={selectedPrefix}
                    onChange={(e) => {
                      setSelectedPrefix(e.target.value);
                      setSelectedSuffix(''); // Reset suffix when prefix changes
                    }}
                    className="w-full px-4 py-2 border border-lithium-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nickel-500 bg-white"
                  >
                    <option value="">선택</option>
                    <option value="제조">제조</option>
                    <option value="판관">판관</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-lithium-600 mb-1">소속 그룹</label>
                  <select
                    value={selectedSuffix}
                    onChange={(e) => setSelectedSuffix(e.target.value)}
                    disabled={!selectedPrefix}
                    className="w-full px-4 py-2 border border-lithium-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nickel-500 bg-white disabled:bg-lithium-100 disabled:text-lithium-500"
                  >
                    <option value="">그룹 선택</option>
                    {Array.from(new Set(
                      categories
                        .filter(cat => cat.name.startsWith(selectedPrefix))
                        .map(cat => cat.name.split(' - ')[1] || cat.name)
                    )).sort().map(suffix => (
                      <option key={suffix} value={suffix}>{suffix}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-lithium-600 mb-1">계정 코드</label>
                <input
                  type="text"
                  value={newAccountCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numCount = val.replace(/[^0-9]/g, '').length;
                    if (numCount <= 8) {
                      setNewAccountCode(val);
                    }
                  }}
                  onPaste={(e) => e.stopPropagation()}
                  placeholder="예: A60629130"
                  className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 ${
                    newAccountCode && !isCodeValid(newAccountCode) 
                      ? 'border-red-500 focus:ring-red-100' 
                      : 'border-lithium-300 focus:ring-nickel-500'
                  }`}
                />
                {newAccountCode && !isCodeValid(newAccountCode) && (
                  <p className="mt-1 text-xs text-red-500 font-medium">
                    계정 코드는 'A' 또는 'B'를 포함해야 합니다.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-lithium-600 mb-1">계정명</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  onPaste={(e) => e.stopPropagation()}
                  placeholder="예: 제조비용_환경관리비_교육훈련비"
                  className="w-full px-4 py-2 border border-lithium-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nickel-500"
                />
              </div>

              <div className="mt-4 p-4 bg-lithium-100 rounded-xl">
                <p className="text-sm font-medium text-lithium-600 mb-2">반영 미리보기 :</p>
                <p className="text-eco-black font-bold">
                  {selectedPrefix && selectedSuffix ? `[${selectedPrefix} - ${selectedSuffix}] ` : ''}[{newAccountCode || '계정코드'}] {newAccountName || '계정명'}
                </p>
              </div>

              <div className="mt-6">
                <p className="text-xs text-lithium-500 mb-2">또는 엑셀 데이터를 복사하여 아래에 붙여넣기 하세요.</p>
                <div 
                  tabIndex={0}
                  onPaste={(e) => {
                    e.stopPropagation();
                    handlePaste(e);
                  }}
                  className="p-4 border-2 border-dashed border-lithium-200 rounded-xl bg-lithium-50 flex flex-col items-center justify-center text-center cursor-text hover:border-nickel-500 transition-colors focus:outline-none focus:ring-2 focus:ring-nickel-100"
                >
                  <ClipboardPaste className="w-5 h-5 text-nickel-600 mb-2" />
                  <p className="text-sm text-lithium-600 font-medium">여기를 클릭하고 Ctrl + V</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-lithium-200 bg-lithium-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-lithium-600 font-medium hover:bg-lithium-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleAddAccount}
                disabled={isAddButtonDisabled}
                className={`px-4 py-2 font-medium rounded-xl transition-colors ${
                  isAddButtonDisabled 
                    ? 'bg-lithium-200 text-lithium-500 cursor-not-allowed' 
                    : 'bg-nickel-600 text-white hover:bg-nickel-700'
                }`}
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* [과제 3: 신규 '계정 이동' 모달 및 전사 데이터 연동] - 계정 이동 모달 UI */}
      {isMoveModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onPaste={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-lithium-200 flex justify-between items-center bg-lithium-50">
              <h3 className="text-lg font-bold text-eco-black">계정 이동</h3>
              <button 
                onClick={() => setIsMoveModalOpen(false)}
                className="text-lithium-500 hover:text-eco-black transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-lithium-600 mb-1">이동할 소속 그룹 선택</label>
                <select
                  value={selectedTargetCategory}
                  onChange={(e) => setSelectedTargetCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-lithium-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nickel-500 bg-white"
                >
                  <option value="">그룹을 선택하세요</option>
                  {categories.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 p-4 bg-lithium-100 rounded-xl">
                <p className="text-sm font-medium text-lithium-600 mb-2">선택된 계정 수 :</p>
                <p className="text-eco-black font-bold">
                  {currentSelected.size}개
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-lithium-200 bg-lithium-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsMoveModalOpen(false)}
                className="px-4 py-2 text-lithium-600 font-medium hover:bg-lithium-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleMoveAccounts}
                className="px-4 py-2 bg-nickel-600 text-white font-medium hover:bg-nickel-700 rounded-xl transition-colors"
              >
                이동하기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-eco-black mb-2">
                {modalConfig.type === 'confirm' ? '확인' : '알림'}
              </h3>
              <p className="text-lithium-600 text-sm leading-relaxed">
                {modalConfig.message}
              </p>
            </div>
            <div className="bg-lithium-50 px-6 py-4 flex justify-end gap-2 border-t border-lithium-200">
              {modalConfig.type === 'confirm' && (
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-lithium-600 bg-white border border-lithium-300 rounded-xl hover:bg-lithium-50 transition-colors"
                >
                  취소
                </button>
              )}
              <button
                onClick={() => {
                  closeModal();
                  if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
                    modalConfig.onConfirm();
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-nickel-600 rounded-xl hover:bg-nickel-700 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onPaste={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-lithium-200 flex justify-between items-center bg-lithium-50">
              <h3 className="text-lg font-bold text-eco-black">계정 삭제</h3>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-lithium-500 hover:text-eco-black transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-lithium-600 mb-4">
                선택한 {currentSelected.size}개의 계정을 정말 삭제하시겠습니까?
              </p>
              <p className="text-sm text-red-500 font-medium">
                주의: 전사 목록에서 완전히 삭제되며, 다른 부서의 선택 내역에서도 삭제됩니다.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-lithium-200 bg-lithium-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-lithium-600 font-medium hover:bg-lithium-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={confirmDeleteAccounts}
                className="px-4 py-2 bg-red-500 text-white font-medium hover:bg-red-600 rounded-xl transition-colors"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regroup Account Modal */}
      {isRegroupModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onPaste={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-lithium-200 flex justify-between items-center bg-lithium-50">
              <h3 className="text-lg font-bold text-eco-black">계정 재그룹화</h3>
              <button 
                onClick={() => setIsRegroupModalOpen(false)}
                className="text-lithium-500 hover:text-eco-black transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-lithium-600">
                모든 계정을 기본 분류 체계에 맞게 다시 그룹화하시겠습니까?
              </p>
            </div>

            <div className="px-6 py-4 border-t border-lithium-200 bg-lithium-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsRegroupModalOpen(false)}
                className="px-4 py-2 text-lithium-600 font-medium hover:bg-lithium-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={confirmRegroupAccounts}
                className="px-4 py-2 bg-nickel-600 text-white font-medium hover:bg-nickel-700 rounded-xl transition-colors"
              >
                재그룹화
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Spacer to prevent content overlapping with sticky footer */}
      <div className="h-24"></div>

      {/* 하단 Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-6 py-4 animate-in slide-in-from-bottom duration-300">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-zinc-650 text-xs md:text-sm font-medium">
            선택 계정: <span className="text-[#008f83] font-black text-lg font-mono">{currentSelected.size}</span>개 항목이 <span className="bg-zinc-100 text-zinc-800 font-bold px-2 py-0.5 rounded text-xs">{currentDept?.name || selectedDeptCode}</span> 부서에 선택되었습니다.
          </div>
          <div className="flex gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleSave}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs md:text-sm font-semibold transition shadow-sm"
            >
              <Save className="w-4 h-4 text-zinc-500" />
              선택 저장
            </button>
            <button
              onClick={() => {
                handleSave();
                // We add a tiny delay to give the browser time to save selections
                setTimeout(() => {
                  navigate('/budget-creation');
                }, 100);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2 bg-[#008f83] hover:bg-[#00786f] text-white rounded-xl text-xs md:text-sm font-bold border border-[#008f83] transition shadow-md"
            >
              예산 작성으로 이동
              <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
