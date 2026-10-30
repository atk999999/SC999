import React, { useState, useEffect, useRef, useCallback } from 'react';

const INITIAL_STATS = {
  ready: false,
  charName: 'Đạo Hữu',
  realmName: 'Phàm Nhân',
  realmId: 'pham_nhan',
  exp: 0,
  expMax: 100,
  stones: 0,
  duocCong: 0,
  stage: 0,
  stageTitle: 'Nhập Môn',
  mapName: 'Tản Viên Sơn'
};

export default function App() {
  const iframeRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'tools' | 'save' | null
  const [stats, setStats] = useState(INITIAL_STATS);
  const [toastMsg, setToastMsg] = useState('');
  const [saveJsonText, setSaveJsonText] = useState('');

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win && win.PNTT && win.PNTT.HUD && typeof win.PNTT.HUD.toast === 'function') {
      try {
        win.PNTT.HUD.toast(msg);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(''), 2800);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const syncFromGame = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    try {
      const win = iframe.contentWindow;
      const P = win.PNTT;
      if (!P || !P.Progress) return;

      let charName = 'Đạo Hữu';
      try {
        const rawChar = win.localStorage.getItem((P.CONFIG && P.CONFIG.STORAGE_KEY) || 'pntt_character_v1');
        if (rawChar) {
          const parsed = JSON.parse(rawChar);
          if (parsed && parsed.name) charName = parsed.name;
        }
      } catch (e) {}

      const realmId = P.Progress.realmId || 'pham_nhan';
      const realmObj = P.realmById ? P.realmById(realmId) : null;
      const realmName = (realmObj && realmObj.name) || realmId;
      const exp = Math.floor(Number(P.Progress.exp) || 0);
      const expMax = (realmObj && realmObj.expMax) || 0;
      const stones = Math.floor(Number(P.Progress.stones) || 0);
      const duocCong = Math.floor(Number(P.Progress.duocCong) || 0);
      const stage = (P.Quest && P.Quest.stage) || 0;
      const sInfo = P.Quest && P.Quest.stageInfo ? P.Quest.stageInfo() : null;
      const stageTitle = (sInfo && sInfo.name) || `Giai đoạn ${stage}`;
      const mapName =
        (P.SceneWorld && P.SceneWorld.map && P.SceneWorld.map.data && P.SceneWorld.map.data.name) ||
        'Tu Tiên Giới';

      setStats({
        ready: true,
        charName,
        realmName,
        realmId,
        exp,
        expMax,
        stones,
        duocCong,
        stage,
        stageTitle,
        mapName
      });
    } catch (err) {
      // Cross-frame or early boot ignore
    }
  }, []);

  useEffect(() => {
    const id = setInterval(syncFromGame, 1000);
    return () => clearInterval(id);
  }, [syncFromGame]);

  const withPNTT = useCallback(
    (fn) => {
      const iframe = iframeRef.current;
      const win = iframe && iframe.contentWindow;
      const P = win && win.PNTT;
      if (!P || !P.Progress) {
        showToast('Game đang khởi tạo, vui lòng đợi giây lát...');
        return;
      }
      fn(P, win);
      syncFromGame();
    },
    [showToast, syncFromGame]
  );

  const handleAddStones = (amount) => {
    withPNTT((P) => {
      P.Progress.addStones(amount);
      showToast(`Đã nhận +${amount.toLocaleString('vi-VN')} Linh Thạch!`);
    });
  };

  const handleAddDuocCong = (amount) => {
    withPNTT((P) => {
      P.Progress.addDuocCong(amount);
      showToast(`Đã nhận +${amount} Dược Công!`);
    });
  };

  const handleFillExp = () => {
    withPNTT((P) => {
      const r = P.realmById ? P.realmById(P.Progress.realmId) : null;
      const targetExp = r && r.expMax > 0 ? r.expMax : 150;
      P.Progress.exp = targetExp;
      if (P.Quest && P.Quest.save) P.Quest.save();
      showToast(`Đã tích đầy Đạo Hạnh (${targetExp.toLocaleString('vi-VN')})!`);
    });
  };

  const handleBreakthroughNext = () => {
    withPNTT((P) => {
      const realms = P.REALMS || [];
      const idx = P.realmIndexById ? P.realmIndexById(P.Progress.realmId) : 0;
      const next = realms[idx + 1];
      if (!next) {
        showToast('Đạo hữu đã đạt đỉnh phong cảnh giới hiện tại!');
        return;
      }
      P.Progress.realmId = next.id;
      P.Progress.exp = 0;
      if (P.SceneWorld && P.SceneWorld.player) {
        const pl = P.SceneWorld.player;
        pl.hp = next.hpMax || pl.hpMax || 100;
        pl.mp = next.mpMax || pl.mpMax || 100;
        pl.sp = next.spMax || pl.spMax || 50;
        pl.bp = next.bpMax || pl.bpMax || 50;
      }
      if (P.Quest && P.Quest.save) P.Quest.save();
      showToast(`Đột phá thành công lên ${next.name}!`);
    });
  };

  const handleRestoreVitals = () => {
    withPNTT((P) => {
      const r = P.realmById ? P.realmById(P.Progress.realmId) : null;
      if (P.SceneWorld && P.SceneWorld.player) {
        const pl = P.SceneWorld.player;
        pl.hp = pl.hpMax || (r && r.hpMax) || 200;
        pl.mp = pl.mpMax || (r && r.mpMax) || 200;
        pl.sp = pl.spMax || (r && r.spMax) || 100;
        pl.bp = pl.bpMax || (r && r.bpMax) || 100;
      }
      showToast('Đã hồi đầy Khí Huyết, Linh Lực, Thần Thức và Giáp!');
    });
  };

  const handleGrantStarterKit = () => {
    withPNTT((P) => {
      if (!P.Inventory) return;
      const kit = [
        ['tay_tuy_thang', 2],
        ['tu_khi_duoc', 2],
        ['tu_khi_dan', 5],
        ['luyen_khi_dan', 5],
        ['pha_canh_dan', 10],
        ['truc_co_dan', 2],
        ['ngung_nguyen_dan', 2],
        ['dinh_co_dan', 2],
        ['phi_diep', 1],
        ['huyen_thiet_khoang', 50],
        ['yeu_cot', 30],
        ['linh_thuy', 20]
      ];
      kit.forEach(([id, qty]) => P.Inventory.add(id, qty));
      if (P.Quest) {
        P.Quest.flags.phi_diep_da_trao = true;
        P.Quest.save();
      }
      showToast('Đã trao Túi Pháp Bảo & Đan Dược Phá Quan vào Hành Trang!');
    });
  };

  const handleOpenSaveModal = () => {
    const iframe = iframeRef.current;
    const win = (iframe && iframe.contentWindow) || window;
    const data = {};
    try {
      for (let i = 0; i < win.localStorage.length; i++) {
        const k = win.localStorage.key(i);
        if (k && k.startsWith('pntt_')) {
          data[k] = win.localStorage.getItem(k);
        }
      }
    } catch (e) {}
    setSaveJsonText(JSON.stringify(data, null, 2));
    setActiveModal(activeModal === 'save' ? null : 'save');
  };

  const handleDownloadSave = () => {
    try {
      const blob = new Blob([saveJsonText || '{}'], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tutien2d-save-${stats.charName || 'daohuu'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Đã tải xuống file sao lưu JSON!');
    } catch (e) {
      showToast('Không thể tải file sao lưu.');
    }
  };

  const handleImportSave = () => {
    try {
      const parsed = JSON.parse(saveJsonText);
      const iframe = iframeRef.current;
      const win = (iframe && iframe.contentWindow) || window;
      Object.keys(parsed).forEach((k) => {
        if (k.startsWith('pntt_') && typeof parsed[k] === 'string') {
          win.localStorage.setItem(k, parsed[k]);
        }
      });
      setActiveModal(null);
      showToast('Đã khôi phục dữ liệu Save! Đang tải lại...');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.location.reload();
      }
    } catch (e) {
      showToast('Dữ liệu JSON không hợp lệ, vui lòng kiểm tra lại!');
    }
  };

  const handleReloadGame = () => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.location.reload();
      showToast('Đang tải lại Tu Tiên Giới...');
    }
  };

  const handleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="aistudio-shell">
      {collapsed ? (
        <button
          type="button"
          className="daodai-floating-pill"
          onClick={() => setCollapsed(false)}
          title="Mở thanh công cụ Đạo Đài AI Studio"
        >
          ☯ Đạo Đài ({stats.realmName})
        </button>
      ) : (
        <header className="daodai-topbar">
          <div className="daodai-brand">
            <span className="daodai-orb">☯</span>
            <span className="daodai-title">Tu Tiên 2D</span>
            <span className="daodai-badge">React AI Studio</span>
          </div>

          <div className="daodai-telemetry">
            <span className="tele-pill" title="Đạo hiệu & Bản đồ">
              <strong>{stats.charName}</strong> · {stats.mapName}
            </span>
            <span className="tele-pill tele-realm" title="Cảnh giới tu luyện">
              ✦ {stats.realmName}
            </span>
            <span className="tele-pill" title="Đạo Hạnh hiện tại">
              Đạo Hạnh: {stats.exp.toLocaleString('vi-VN')}
              {stats.expMax > 0 ? ` / ${stats.expMax.toLocaleString('vi-VN')}` : ''}
            </span>
            <span className="tele-pill tele-stone" title="Linh Thạch trong túi">
              💎 {stats.stones.toLocaleString('vi-VN')}
            </span>
            <span className="tele-pill" title="Điểm Dược Công">
              🌿 Dược Công: {stats.duocCong}
            </span>
          </div>

          <div className="daodai-actions">
            <button
              type="button"
              className={`daodai-btn ${activeModal === 'tools' ? 'active' : ''}`}
              onClick={() => setActiveModal(activeModal === 'tools' ? null : 'tools')}
            >
              ⚡ Trợ Giúp Tu Luyện
            </button>
            <button
              type="button"
              className={`daodai-btn ${activeModal === 'save' ? 'active' : ''}`}
              onClick={handleOpenSaveModal}
            >
              💾 Sao Lưu Save
            </button>
            <button type="button" className="daodai-btn" onClick={handleFullscreen} title="Toàn màn hình">
              ⛶
            </button>
            <button type="button" className="daodai-btn" onClick={handleReloadGame} title="Tải lại game">
              🔄
            </button>
            <button
              type="button"
              className="daodai-btn daodai-btn-subtle"
              onClick={() => {
                setActiveModal(null);
                setCollapsed(true);
              }}
              title="Thu gọn thanh Đạo Đài"
            >
              ▲ Ẩn
            </button>
          </div>
        </header>
      )}

      {toastMsg ? <div className="daodai-toast">{toastMsg}</div> : null}

      {activeModal === 'tools' ? (
        <aside className="daodai-drawer">
          <div className="drawer-header">
            <h3>⚡ Pháp Bảo Trợ Giúp Ngoại Tuyến (React Bridge)</h3>
            <button type="button" className="drawer-close" onClick={() => setActiveModal(null)}>
              ✕
            </button>
          </div>
          <p className="drawer-desc">
            Công cụ kết nối trực tiếp với nhân lõi <code>window.PNTT</code> để hỗ trợ test nhanh cảnh giới, đan dược và tài nguyên khi chơi ngoại tuyến trên Google AI Studio.
          </p>
          <div className="drawer-grid">
            <button type="button" className="tool-card" onClick={() => handleAddStones(1000)}>
              <strong>+1.000 Linh Thạch</strong>
              <span>Thêm linh thạch mua pháp khí &amp; rút bí tịch</span>
            </button>
            <button type="button" className="tool-card" onClick={() => handleAddStones(10000)}>
              <strong>+10.000 Linh Thạch</strong>
              <span>Nhận ngân quỹ lớn cho Tàng Kinh Thượng Phẩm</span>
            </button>
            <button type="button" className="tool-card" onClick={() => handleAddDuocCong(50)}>
              <strong>+50 Dược Công</strong>
              <span>Đổi hạt giống linh thảo ở Đại Phu</span>
            </button>
            <button type="button" className="tool-card" onClick={handleFillExp}>
              <strong>Đầy Đạo Hạnh</strong>
              <span>Tích mãn tu vi tầng hiện tại để phá quan</span>
            </button>
            <button type="button" className="tool-card" onClick={handleRestoreVitals}>
              <strong>Hồi Đầy Trạng Thái</strong>
              <span>Phục hồi 100% Khí Huyết, Linh Lực, Thần Thức</span>
            </button>
            <button type="button" className="tool-card" onClick={handleBreakthroughNext}>
              <strong>Đột Phá Cảnh Giới Kế</strong>
              <span>Thăng cấp trực tiếp lên tầng tu vi tiếp theo</span>
            </button>
            <button type="button" className="tool-card tool-card-wide" onClick={handleGrantStarterKit}>
              <strong>🎁 Nhận Túi Đan Dược Phá Quan &amp; Nguyên Liệu Rèn</strong>
              <span>Tặng Tẩy Tuỷ Thang, Tụ Khí Đan, Luyện Khí Đan, Phá Cảnh Đan, Trúc Cơ Đan, Phi Diệp, Huyền Thiết &amp; Linh Thúy</span>
            </button>
          </div>
          <div className="drawer-footer">
            <span>Nhiệm vụ hiện tại: <strong>{stats.stageTitle}</strong></span>
          </div>
        </aside>
      ) : null}

      {activeModal === 'save' ? (
        <aside className="daodai-drawer">
          <div className="drawer-header">
            <h3>💾 Quản Lý Dữ Liệu Lưu Trữ (LocalStorage JSON)</h3>
            <button type="button" className="drawer-close" onClick={() => setActiveModal(null)}>
              ✕
            </button>
          </div>
          <p className="drawer-desc">
            Sao lưu tiến trình tu luyện ra file <code>.json</code> hoặc dán dữ liệu JSON vào ô bên dưới để khôi phục nhân vật.
          </p>
          <textarea
            className="save-textarea"
            value={saveJsonText}
            onChange={(e) => setSaveJsonText(e.target.value)}
            rows={8}
          />
          <div className="drawer-actions">
            <button type="button" className="daodai-btn active" onClick={handleDownloadSave}>
              ⬇ Tải File Save (.json)
            </button>
            <button type="button" className="daodai-btn" onClick={handleImportSave}>
              ⬆ Khôi Phục Từ JSON Này
            </button>
          </div>
        </aside>
      ) : null}

      <main className="game-viewport">
        <iframe
          ref={iframeRef}
          className="game-frame"
          title="Tu Tiên 2D"
          src="./legacy/index.html"
          allow="fullscreen; autoplay"
        />
      </main>
    </div>
  );
}
