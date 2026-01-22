
console.log("sidebar.js loaded");
console.log("before mobile toggle init");
/* =========================================================
   common.js (교체용 전체)
   - index /pages/* /pages/projects/* 모두 안전
   - fetch ok 체크 + 디버그 로그
   - .sidebar가 내부에 있든 없든 CSS/토글 동작 유지
========================================================= */

// ✅ 0) 로드 여부 확인(이 로그가 index 콘솔에 안 뜨면 "script src 경로" 문제입니다)
console.log("[sidebar.js] loaded:", location.pathname);

document.addEventListener("DOMContentLoaded", async () => {
  const host = document.querySelector("#sidebar");
  if (!host) return;

  // ✅ 현재 위치 구분: /pages/projects/* , /pages/* , / (index)
  const path = location.pathname;
  const inProjectPage = path.includes("/pages/projects/");
  const inPages = !inProjectPage && path.includes("/pages/");

  // ✅ sidebar.html 경로(현재 문서 기준 상대경로)
  const sidebarPath = inProjectPage
    ? "../partials/sidebar.html"          // /pages/projects/* -> /pages/partials/sidebar.html
    : inPages
      ? "partials/sidebar.html"           // /pages/* -> /pages/partials/sidebar.html
      : "pages/partials/sidebar.html";    // /index.html -> /pages/partials/sidebar.html

  try {
    const res = await fetch(sidebarPath, { cache: "no-cache" });
    if (!res.ok) throw new Error(`fetch failed: ${sidebarPath} (${res.status})`);

    const html = await res.text();
    host.innerHTML = html;

    // ✅ CSS 타겟이 ".sidebar"일 수도 있고 "#sidebar.sidebar"일 수도 있어서 둘 다 대응
    //    - 주입된 HTML 안에 .sidebar가 있으면: host에는 굳이 붙이지 않음
    //    - 없으면: host 자체를 .sidebar로 취급
    const injectedSidebar = host.querySelector(".sidebar");
    if (injectedSidebar) {
      host.classList.remove("sidebar");
    } else {
      host.classList.add("sidebar");
    }

    // ✅ 링크를 상대경로로 통일 (GitHub Pages/로컬 안전)
    const root = inProjectPage ? "../../" : (inPages ? "../" : "");
    const homeHref = root + "index.html";
    const projectBase = root + "pages/projects/";

    // 홈 링크
    const titleLink = host.querySelector(".sidebar-title");
    if (titleLink) {
      titleLink.href = homeHref;
      titleLink.removeAttribute("data-page");
    }

    // 프로젝트 링크들
    host.querySelectorAll("a.sidebar-project").forEach((a) => {
      let file = a.getAttribute("data-file");

      if (!file) {
        const src = a.getAttribute("data-page") || a.getAttribute("href") || "";
        file = src.split("/").pop();
      }
      if (!file) return;

      a.href = projectBase + file;
      a.removeAttribute("data-page");
    });
  } catch (e) {
    console.error("Sidebar load failed", e);
    console.log("DEBUG:", { path, sidebarPath });
  }
});

/* ==============================
   Mobile Sidebar Toggle (stable)
   - MutationObserver 폭주 방지(디바운스)
   - body 전체 감시 X -> #sidebar만 감시
============================== */
(() => {
  const mq = window.matchMedia("(max-width: 1024px)");
  const isMobile = () => mq.matches;

  const getHost = () => document.getElementById("sidebar");
  const getSidebarEl = () => {
    const host = getHost();
    if (!host) return null;
    return host.querySelector(".sidebar") || host; // 내부 .sidebar 우선, 없으면 host
  };

  const ensureOverlay = () => {
    let ov = document.querySelector(".sidebar-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "sidebar-overlay";
      document.body.appendChild(ov);
    }
    return ov;
  };

  const ensureButton = () => {
    let btn =
      document.querySelector(".mobile-sidebar-toggle") ||
      document.querySelector(".mobile-header .menu-toggle") ||
      document.querySelector("[data-role='menu-toggle']");

    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      document.body.appendChild(btn);
    }

    // ✅ 속성/텍스트는 최초 1회만 세팅(불필요한 DOM 업데이트 최소화)
    if (!btn.classList.contains("mobile-sidebar-toggle")) {
      btn.classList.add("mobile-sidebar-toggle");
      btn.textContent = "☰";
      btn.title = "메뉴";
      btn.setAttribute("aria-label", "메뉴 열기");
    }

    return btn;
  };

  const setOpen = (open) => {
    const sb = getSidebarEl();
    const ov = ensureOverlay();

    document.body.classList.toggle("menu-open", open);
    document.body.classList.toggle("no-scroll", open);

    ov.classList.toggle("active", open);
    if (sb) sb.classList.toggle("active", open);
  };

  const toggle = () => {
    const sb = getSidebarEl();
    const open = sb
      ? !sb.classList.contains("active")
      : !document.body.classList.contains("menu-open");
    setOpen(open);
  };

  // ✅ init 디바운스: DOM 변경이 연속으로 와도 1프레임에 1번만 실행
  let scheduled = false;
  const scheduleInit = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      init();
    });
  };

  const init = () => {
    // 모바일에서만 버튼/오버레이 의미 있으니 조건 처리(불필요 실행 감소)
    if (isMobile()) {
      ensureButton();
      ensureOverlay();
    }

    // 주입 타이밍에 따라 현재 상태 동기화
    const sb = getSidebarEl();
    if (sb) sb.classList.toggle("active", document.body.classList.contains("menu-open"));
  };

  // 클릭 핸들링(이벤트 위임) - 1회만 등록
  document.addEventListener(
    "click",
    (e) => {
      if (!isMobile()) return;

      const toggleBtn = e.target.closest(".mobile-sidebar-toggle");
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
        return;
      }

      if (e.target.closest(".sidebar-overlay")) {
        setOpen(false);
        return;
      }

      if (e.target.closest("#sidebar a, .sidebar a")) {
        setTimeout(() => setOpen(false), 0);
      }
    },
    true
  );

  // ✅ 관측 범위 최소화: body 전체 말고 #sidebar만
  const startObserver = () => {
    const host = getHost();
    if (!host) return;

    const obs = new MutationObserver(() => scheduleInit());
    obs.observe(host, { childList: true, subtree: true });

    // 최초 1회
    scheduleInit();

    // 화면이 데스크톱으로 바뀌면 닫기
    mq.addEventListener?.("change", () => {
      if (!isMobile()) setOpen(false);
      scheduleInit();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }
})();

/* ==============================
   Dark mode (no-freeze)
============================== */
(() => {
  const KEY = "theme";

  const updateLabel = () => {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;

    const isDark = document.documentElement.classList.contains("dark");
    btn.textContent = isDark ? "라이트 ◐" : "다크 ◑";
    btn.title = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
    btn.setAttribute("aria-label", btn.title);
  };

  // 초기 적용
  const saved = localStorage.getItem(KEY);
  document.documentElement.classList.toggle("dark", saved === "dark");
  updateLabel();

  // 클릭 시 토글 (이벤트 위임 유지)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-toggle");
    if (!btn) return;

    const isDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", !isDark);
    localStorage.setItem(KEY, !isDark ? "dark" : "light");
    updateLabel();
  });

  // ✅ sidebar가 주입되는 시점에만 1회 갱신(있으면)
  const host = document.getElementById("sidebar");
  if (host) {
    const obs = new MutationObserver(() => {
      updateLabel();
      obs.disconnect(); // ✅ 1회만 실행하고 종료
    });
    obs.observe(host, { childList: true, subtree: true });
  }

  updateLabel();
})();
