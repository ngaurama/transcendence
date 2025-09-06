// effects.ts

export function initEnhancedEffects(): void {
  // Glossy button hover effects
  document.querySelectorAll<HTMLButtonElement>('.btn-glossy').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-3px)';
      btn.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });
  });

  // General button press effects
  document.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.95)';
    });

    btn.addEventListener('mouseup', () => {
      btn.style.transform = '';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // Floating circles follow mouse
  document.addEventListener('mousemove', (e: MouseEvent) => {
    const floatingCircles = document.querySelectorAll<HTMLElement>('.floating-circle');
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;

    floatingCircles.forEach((circle, index) => {
      const speed = 0.01 + index * 0.01;
      const xOffset = (x - 0.5) * 20 * speed;
      const yOffset = (y - 0.5) * 20 * speed;

      circle.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    });
  });

  // Typewriter effect
  document.querySelectorAll<HTMLElement>('[data-typewriter]').forEach(el => {
    const text: string = el.textContent ?? '';
    el.textContent = '';
    let i = 0;

    function typeWriter() {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
      }
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          typeWriter();
          observer.unobserve(entry.target);
        }
      });
    });

    observer.observe(el);
  });

  // Counter effect
  document.querySelectorAll<HTMLElement>('[data-counter]').forEach(el => {
    const targetAttr = el.getAttribute('data-counter');
    const target = targetAttr ? parseInt(targetAttr, 10) : 0;
    const duration = 2000; // ms
    const steps = 60;
    const stepValue = target / steps;
    let current = 0;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const timer = setInterval(() => {
            current += stepValue;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = Math.round(current).toString();
          }, duration / steps);

          observer.unobserve(entry.target);
        }
      });
    });

    observer.observe(el);
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancedEffects);
} else {
  initEnhancedEffects();
}

