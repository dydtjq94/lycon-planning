import React from "react";
import styles from "./TableOfContentsPage.module.css";

/**
 * 보고서 목차 페이지
 */
function TableOfContentsPage() {
  const agendaItems = [
    {
      number: "01",
      title: "은퇴 준비 상태 진단",
      description: "은퇴목표 검증 및 자산/현금흐름 준비율 분석",
    },
    {
      number: "02",
      title: "가계 재무현황 진단",
      description: "자산 구성, 부채 적정성 및 유동성 점검",
    },
    {
      number: "03",
      title: "소득·지출 패턴 분석",
      description: "현금흐름 구조 분석 및 개선 전략 도출",
    },
    {
      number: "04",
      title: "은퇴 리스크 진단",
      description: "예상 이벤트 반영 및 리스크 해소 방안",
    },
  ];

  return (
    <div className={styles.slideContainer}>
      {/* 배경 장식 요소 */}
      <div className={`${styles.circleDeco} ${styles.circleDeco1}`}></div>
      <div className={`${styles.circleDeco} ${styles.circleDeco2}`}></div>
      <div className={styles.verticalLine}></div>
      <div className={styles.horizontalLine}></div>

      {/* 왼쪽: 타이틀 영역 */}
      <div className={styles.leftSection}>
        <div className={styles.titleArea}>
          <div className={styles.agendaHeader}>
            <div className={styles.goldLine}></div>
            <p className={styles.agendaLabel}>Agenda</p>
          </div>
          <h1 className={styles.mainTitle}>
            진단 프로그램<br />목차
          </h1>
        </div>

        {/* 장식용 페이지 번호 */}
        <div className={styles.pageNumber}>02</div>
      </div>

      {/* 오른쪽: 목차 리스트 영역 */}
      <div className={styles.rightSection}>
        <div className={styles.listContainer}>
          {agendaItems.map((item, index) => (
            <div key={index} className={styles.listItem}>
              <div className={styles.itemNumber}>
                <span>{item.number}</span>
              </div>
              <div className={styles.itemContent}>
                <h2 className={styles.itemTitle}>{item.title}</h2>
                <p className={styles.itemDescription}>{item.description}</p>
              </div>
              <div className={styles.itemArrow}>
                <i className="fas fa-chevron-right"></i>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TableOfContentsPage;
