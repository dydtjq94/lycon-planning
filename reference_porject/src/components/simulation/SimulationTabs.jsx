import React, { useState, useRef, useEffect } from "react";
import styles from "./SimulationTabs.module.css";

/**
 * 시뮬레이션 탭 컴포넌트
 * 여러 시뮬레이션을 탭 형태로 전환하고 새로운 시뮬레이션을 추가할 수 있습니다.
 *
 * @param {Array} simulations - 시뮬레이션 목록
 * @param {string} activeSimulationId - 현재 활성화된 시뮬레이션 ID
 * @param {Function} onTabChange - 탭 변경 시 호출되는 함수
 * @param {Function} onAddSimulation - 새 시뮬레이션 추가 시 호출되는 함수
 * @param {Function} onDeleteSimulation - 시뮬레이션 삭제 시 호출되는 함수
 * @param {Function} onRenameSimulation - 시뮬레이션 이름 변경 시 호출되는 함수
 * @param {Function} onCopySimulation - 시뮬레이션 복제 시 호출되는 함수
 */
function SimulationTabs({
  simulations,
  activeSimulationId,
  onTabChange,
  onAddSimulation,
  onDeleteSimulation,
  onRenameSimulation,
  onCopySimulation,
  isReadOnly = false,
}) {
  // 이름 수정 중인 시뮬레이션 ID
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    simulationId: null,
  });

  // 컨텍스트 메뉴 ref
  const contextMenuRef = useRef(null);

  // 컨텍스트 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target)
      ) {
        setContextMenu({ visible: false, x: 0, y: 0, simulationId: null });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu.visible]);

  // 우클릭 핸들러
  const handleContextMenu = (e, simulationId) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      simulationId: simulationId,
    });
  };

  // 시뮬레이션 복제 핸들러
  const handleCopySimulation = (simulationId) => {
    if (onCopySimulation) {
      onCopySimulation(simulationId);
    }
    setContextMenu({ visible: false, x: 0, y: 0, simulationId: null });
  };

  // 탭 클릭 핸들러
  const handleTabClick = (simulationId) => {
    if (editingId) return; // 수정 중일 때는 탭 변경 막기
    onTabChange(simulationId);
  };

  // 이름 수정 시작
  const handleStartEdit = (e, simulation) => {
    e.stopPropagation(); // 탭 클릭 이벤트 방지
    if (simulation.isDefault) return; // 기본 시뮬레이션은 수정 불가
    setEditingId(simulation.id);
    setEditingTitle(simulation.title);
  };

  // 이름 수정 저장
  const handleSaveEdit = (simulationId) => {
    if (editingTitle.trim()) {
      onRenameSimulation(simulationId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  // 이름 수정 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  // Enter 키로 저장, ESC 키로 취소
  const handleKeyDown = (e, simulationId) => {
    if (e.key === "Enter") {
      handleSaveEdit(simulationId);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // 삭제 핸들러
  const handleDelete = (e, simulation) => {
    e.stopPropagation(); // 탭 클릭 이벤트 방지

    if (simulation.isDefault) {
      alert("기본 시뮬레이션('현재')은 삭제할 수 없습니다.");
      return;
    }

    if (
      window.confirm(
        `"${simulation.title}" 시뮬레이션을 삭제하시겠습니까?\n모든 데이터가 삭제됩니다.`
      )
    ) {
      onDeleteSimulation(simulation.id);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {simulations.map((simulation) => (
          <div
            key={simulation.id}
            className={`${styles.tab} ${
              activeSimulationId === simulation.id ? styles.active : ""
            }`}
            onClick={() => handleTabClick(simulation.id)}
            onDoubleClick={(e) =>
              !simulation.isDefault && handleStartEdit(e, simulation)
            }
            onContextMenu={(e) => handleContextMenu(e, simulation.id)}
          >
            {editingId === simulation.id ? (
              // 이름 수정 모드
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, simulation.id)}
                onBlur={() => handleSaveEdit(simulation.id)}
                autoFocus
                className={styles.editInput}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              // 일반 모드
              <>
                <span className={styles.tabTitle}>{simulation.title}</span>

                {/* 삭제 버튼 (크롬 탭의 X 버튼처럼) */}
                {!simulation.isDefault && (
                  <button
                    className={styles.closeButton}
                    onClick={(e) => handleDelete(e, simulation)}
                    title="삭제"
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* 새 시뮬레이션 추가 버튼 */}
        {onAddSimulation && (
          <button
            className={styles.addButton}
            onClick={onAddSimulation}
            title="새 시뮬레이션 추가"
          >
            +
          </button>
        )}
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10001,
          }}
        >
          <button
            className={styles.contextMenuItem}
            onClick={() => handleCopySimulation(contextMenu.simulationId)}
          >
            복제하기
          </button>
        </div>
      )}
    </div>
  );
}

export default SimulationTabs;
