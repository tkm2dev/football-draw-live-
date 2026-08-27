export type DivisionKey='PUBLIC'|'SENIOR40'
export type Group='A'|'B'|'C'|'D'
export type Team={id:string;name:string;seed?:boolean}
const t=(id:string,name:string,seed=false):Team=>({id,name,seed})
export const teams:Record<DivisionKey,Team[]>={
 PUBLIC:[t('p1','นาดอกไม้'),t('p2','เพื่อนและเพื่อน'),t('p3','PPN'),t('p4','สภ.ปลาปาก'),t('p5','สภ.หนองฮี'),t('p6','นาสีนวล'),t('p7','NPล้านเค้ก'),t('p8','โพนทา FC.'),t('p9','Thunder FC.'),t('p10','วังโพธิ์ FC.'),t('p11','วังสิม FC.'),t('p12','มหาชัย')],
 SENIOR40:[t('s1','สมประสงค์ FC.'),t('s2','เพื่อนเยาวชน',true),t('s3','ลาบโต๊ะแดงกำแพงสูง'),t('s4','ปตท.บายพาส นครพนม',true),t('s5','PB ธาตุพนม'),t('s6','VIP.เพื่อนปลาปาก'),t('s7','ผึ้งหลวง'),t('s8','สหายอาร์มี่'),t('s9','Safe House',true),t('s10','พ่อค้านาแก'),t('s11','โรงพยาบาลนาแก'),t('s12','สหายเรณู')]
}
export const separationRules:Record<DivisionKey,string[][]>={PUBLIC:[],SENIOR40:[['s2','s4'],['s2','s9'],['s4','s9']]}
