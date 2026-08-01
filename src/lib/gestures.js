// ============================================================
// INNOVIO — Gesture Detection Library
// Swipe detection with configurable thresholds
// ============================================================

const DEFAULT_OPTIONS = {
  threshold: 50,        // Minimum distance in px to trigger swipe
  velocityThreshold: 0.3, // Minimum velocity (px/ms)
  directionLock: true,  // Lock to primary direction
};

/**
 * Attach swipe listeners to an element
 * @param {HTMLElement} el - Target element
 * @param {Object} handlers - { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }
 * @param {Object} options - Configuration overrides
 * @returns {Function} cleanup function to remove listeners
 */
export function onSwipe(el, handlers = {}, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let startX = 0, startY = 0, startTime = 0;
  let tracking = false;

  function handleStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    tracking = true;
  }

  function handleMove(e) {
    if (!tracking) return;
    // Optional: provide visual feedback during swipe
    if (handlers.onSwipeMove) {
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      handlers.onSwipeMove({ dx, dy, startX, startY });
    }
  }

  function handleEnd(e) {
    if (!tracking) return;
    tracking = false;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const dt = Date.now() - startTime;
    
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const velocity = Math.max(absDx, absDy) / dt;

    // Must meet threshold and velocity
    if (velocity < opts.velocityThreshold) return;
    
    if (opts.directionLock) {
      // Determine primary direction
      if (absDx > absDy) {
        // Horizontal swipe
        if (absDx < opts.threshold) return;
        if (dx > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight({ dx, dy, velocity });
        } else if (dx < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft({ dx, dy, velocity });
        }
      } else {
        // Vertical swipe
        if (absDy < opts.threshold) return;
        if (dy > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown({ dx, dy, velocity });
        } else if (dy < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp({ dx, dy, velocity });
        }
      }
    }

    if (handlers.onSwipeEnd) {
      handlers.onSwipeEnd({ dx, dy, velocity });
    }
  }

  el.addEventListener('touchstart', handleStart, { passive: true });
  el.addEventListener('touchmove', handleMove, { passive: true });
  el.addEventListener('touchend', handleEnd, { passive: true });

  // Return cleanup function
  return () => {
    el.removeEventListener('touchstart', handleStart);
    el.removeEventListener('touchmove', handleMove);
    el.removeEventListener('touchend', handleEnd);
  };
}

/**
 * Pull-to-refresh gesture
 * @param {HTMLElement} scrollContainer
 * @param {Function} onRefresh - async callback when pull is triggered
 * @returns {Function} cleanup
 */
export function onPullToRefresh(scrollContainer, onRefresh) {
  let startY = 0;
  let pulling = false;
  let indicator = null;

  const PULL_THRESHOLD = 80;

  function createIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = `
      <div class="ptr-spinner">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
    
    if (!document.getElementById('ptr-styles')) {
      const style = document.createElement('style');
      style.id = 'ptr-styles';
      style.textContent = `
        .ptr-indicator {
          position: absolute;
          top: -50px; left: 0; right: 0;
          display: flex; justify-content: center;
          transition: transform 0.3s ease, opacity 0.3s ease;
          z-index: 10;
          pointer-events: none;
        }
        .ptr-indicator.active { opacity: 1; }
        .ptr-indicator.refreshing .ptr-spinner svg {
          animation: ptr-spin 0.8s linear infinite;
        }
        .ptr-spinner {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--surface, #fff);
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent, #00c2a8);
        }
        @keyframes ptr-spin { to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);
    }

    scrollContainer.style.position = 'relative';
    scrollContainer.prepend(indicator);
    return indicator;
  }

  function onTouchStart(e) {
    if (scrollContainer.scrollTop <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }

  function onTouchMove(e) {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && scrollContainer.scrollTop <= 0) {
      const ind = createIndicator();
      const progress = Math.min(dy / PULL_THRESHOLD, 1);
      ind.style.transform = `translateY(${Math.min(dy * 0.5, 60)}px)`;
      ind.style.opacity = progress;
      ind.classList.add('active');
      if (progress >= 1) {
        ind.querySelector('.ptr-spinner').style.color = 'var(--green-mid, #2e7d32)';
      }
    }
  }

  async function onTouchEnd(e) {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;

    if (dy >= PULL_THRESHOLD && scrollContainer.scrollTop <= 0) {
      const ind = createIndicator();
      ind.classList.add('refreshing');
      ind.style.transform = 'translateY(50px)';
      
      try {
        await onRefresh();
      } catch {}
      
      ind.classList.remove('refreshing', 'active');
      ind.style.transform = 'translateY(-50px)';
      ind.style.opacity = '0';
    } else if (indicator) {
      indicator.style.transform = 'translateY(-50px)';
      indicator.style.opacity = '0';
      indicator.classList.remove('active');
    }
  }

  scrollContainer.addEventListener('touchstart', onTouchStart, { passive: true });
  scrollContainer.addEventListener('touchmove', onTouchMove, { passive: false });
  scrollContainer.addEventListener('touchend', onTouchEnd, { passive: true });

  // Prevent overscroll bounce on iOS
  scrollContainer.style.overscrollBehavior = 'contain';

  return () => {
    scrollContainer.removeEventListener('touchstart', onTouchStart);
    scrollContainer.removeEventListener('touchmove', onTouchMove);
    scrollContainer.removeEventListener('touchend', onTouchEnd);
  };
}
