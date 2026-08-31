export const DEFAULT_CUSTOM_SCRIPT = `(() => {
  'use strict';

  const FORM_SELECTOR = '[data-form], [data-quote-form], #quote-form';

  const onlyDigits = (value) => String(value ?? '').replace(/\\D/g, '');
  const normalizeText = (value) =>
    String(value ?? '')
      .toLocaleUpperCase('tr-TR')
      .replace(/\\s+/g, ' ')
      .trim();

  const validators = {
    required(control) {
      if (control.type === 'checkbox') {
        return control.checked ? '' : 'Bu alan zorunludur.';
      }

      if (control.type === 'radio') {
        const form = control.form;
        const checked = form?.querySelector(
          \`input[type="radio"][name="\${CSS.escape(control.name)}"]:checked\`
        );
        return checked ? '' : 'Bir seçim yapın.';
      }

      return String(control.value ?? '').trim()
        ? ''
        : 'Bu alan zorunludur.';
    },

    tc(control) {
      const value = onlyDigits(control.value);
      control.value = value;

      if (!value) return 'TC Kimlik No alanı zorunludur.';
      if (value.length !== 11 || /[^0-9]/.test(value)) {
        return '11 haneli geçerli bir TC Kimlik No girin.';
      }
      if (value[0] === '0') {
        return 'TC Kimlik No 0 ile başlayamaz.';
      }

      let sumOdd = 0, sumEven = 0;
      for (let i = 0; i < 9; i++) {
        if (i % 2 === 0) sumOdd += parseInt(value[i], 10);
        else sumEven += parseInt(value[i], 10);
      }
      const tenth = ((sumOdd * 7) - sumEven) % 10;
      if (tenth !== parseInt(value[9], 10)) {
        return 'Geçersiz TC Kimlik No.';
      }
      const totalSum = (sumOdd + sumEven + tenth) % 10;
      if (totalSum !== parseInt(value[10], 10)) {
        return 'Geçersiz TC Kimlik No.';
      }

      return '';
    },

    'date-past'(control) {
      if (!control.value) return 'Tarih alanı zorunludur.';

      const selectedDate = new Date(\`\${control.value}T00:00:00\`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return selectedDate > today
        ? 'Tarih gelecekte olamaz.'
        : '';
    },

    'plate-tr'(control) {
      const value = normalizeText(control.value).replace(/\\s/g, '');
      control.value = value;

      if (!value) return 'Plaka alanı zorunludur.';
      if (!/^[0-9]{2}[A-ZÇĞİÖŞÜ]{1,3}[0-9]{2,4}$/.test(value)) {
        return 'Geçerli bir plaka girin.';
      }

      return '';
    },

    'registration-serial-tr'(control) {
      const value = normalizeText(control.value).replace(/\\s/g, '');
      control.value = value;

      if (!value) return 'Ruhsat belge seri no alanı zorunludur.';
      if (!/^[A-ZÇĞİÖŞÜ0-9]{5,12}$/.test(value)) {
        return 'Geçerli bir ruhsat belge seri no girin.';
      }

      return '';
    },

    'phone-tr'(control) {
      const digits = onlyDigits(control.value);
      const normalized = digits.startsWith('90')
        ? \`0\${digits.slice(2)}\`
        : digits;

      control.value = normalized;

      if (!normalized) return 'Telefon numarası alanı zorunludur.';
      if (!/^05[0-9]{9}$/.test(normalized)) {
        return '05 ile başlayan 11 haneli telefon numarası girin.';
      }

      return '';
    },

    email(control) {
      const value = String(control.value ?? '').trim();

      if (!value) return control.required ? 'E-posta alanı zorunludur.' : '';
      return /^[^\s@]+@[^\s@]+\\.[^\s@]+$/.test(value)
        ? ''
        : 'Geçerli bir e-posta adresi girin.';
    }
  };

  const inferRules = (control) => {
    if (control.dataset.validate) {
      return control.dataset.validate
        .split('|')
        .map((rule) => rule.trim())
        .filter(Boolean);
    }

    const rules = [];
    const name = control.name;

    if (name === 'tcKimlik') rules.push('tc');
    else if (name === 'dogumTarihi') rules.push('date-past');
    else if (name === 'plaka') rules.push('plate-tr');
    else if (name === 'ruhsatSeriNo') rules.push('registration-serial-tr');
    else if (name === 'telefon') rules.push('phone-tr');
    else if (control.type === 'email') rules.push('email');
    else if (control.required) rules.push('required');

    return rules;
  };

  const getErrorTarget = (form, control) => {
    const explicitTarget = control.dataset.errorTarget;

    if (explicitTarget) {
      return form.querySelector(explicitTarget) ||
        document.querySelector(explicitTarget);
    }

    const describedBy = control.getAttribute('aria-describedby');

    if (describedBy) {
      const firstId = describedBy.trim().split(/\\s+/)[0];
      const target = document.getElementById(firstId);
      if (target) return target;
    }

    return form.querySelector(\`[data-error-for="\${CSS.escape(control.name)}"]\`);
  };

  const setError = (form, control, message) => {
    const target = getErrorTarget(form, control);
    if (target) target.textContent = message;

    control.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  const validateControl = (form, control) => {
    const rules = inferRules(control);

    for (const rule of rules) {
      const validator = validators[rule];
      if (!validator) continue;

      const message = validator(control, form);
      if (message) {
        setError(form, control, message);
        return false;
      }
    }

    setError(form, control, '');
    return true;
  };

  const getRadioGroups = (form) => {
    const names = new Set();

    form
      .querySelectorAll('input[type="radio"][name]')
      .forEach((radio) => names.add(radio.name));

    return [...names];
  };

  const validateRadioGroup = (form, name) => {
    const radios = [
      ...form.querySelectorAll(
        \`input[type="radio"][name="\${CSS.escape(name)}"]\`
      )
    ];

    if (!radios.length) return true;

    const required = radios.some((radio) => radio.required);
    const checked = radios.some((radio) => radio.checked);
    const first = radios[0];

    if (required && !checked) {
      const target =
        form.querySelector(\`[data-error-for="\${CSS.escape(name)}"]\`) ||
        (() => {
          const describedBy = first.getAttribute('aria-describedby');
          return describedBy
            ? document.getElementById(describedBy.split(/\\s+/)[0])
            : null;
        })();

      if (target) target.textContent = 'Bir seçim yapın.';
      radios.forEach((radio) => radio.setAttribute('aria-invalid', 'true'));
      return false;
    }

    const target =
      form.querySelector(\`[data-error-for="\${CSS.escape(name)}"]\`) ||
      (() => {
        const describedBy = first.getAttribute('aria-describedby');
        return describedBy
          ? document.getElementById(describedBy.split(/\\s+/)[0])
          : null;
      })();

    if (target) target.textContent = '';
    radios.forEach((radio) => radio.setAttribute('aria-invalid', 'false'));
    return true;
  };

  const serializeForm = (form) =>
    Object.fromEntries(new FormData(form).entries());

  const initForm = (form) => {
    if (form.dataset.validationReady === 'true') return;
    form.dataset.validationReady = 'true';

    const status =
      form.querySelector('[data-form-status]') ||
      form.querySelector('.form-status');

    const controls = [
      ...form.querySelectorAll(
        'input:not([type="radio"]), select, textarea'
      )
    ];

    controls.forEach((control) => {
      control.addEventListener('blur', () => {
        validateControl(form, control);
      });

      control.addEventListener('input', () => {
        if (control.getAttribute('aria-invalid') === 'true') {
          validateControl(form, control);
        }
      });

      control.addEventListener('change', () => {
        if (
          control.type === 'date' ||
          control.type === 'checkbox' ||
          control.tagName === 'SELECT'
        ) {
          validateControl(form, control);
        }
      });
    });

    getRadioGroups(form).forEach((name) => {
      form
        .querySelectorAll(
          \`input[type="radio"][name="\${CSS.escape(name)}"]\`
        )
        .forEach((radio) => {
          radio.addEventListener('change', () => {
            validateRadioGroup(form, name);
          });
        });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (status) {
        status.textContent = '';
        status.removeAttribute('data-state');
      }

      const controlResults = controls.map((control) => ({
        control,
        valid: validateControl(form, control)
      }));

      const radioResults = getRadioGroups(form).map((name) => ({
        name,
        valid: validateRadioGroup(form, name)
      }));

      const firstInvalidControl =
        controlResults.find((result) => !result.valid)?.control ||
        (() => {
          const firstInvalidGroup = radioResults.find(
            (result) => !result.valid
          );

          return firstInvalidGroup
            ? form.querySelector(
                \`input[type="radio"][name="\${CSS.escape(firstInvalidGroup.name)}"]\`
              )
            : null;
        })();

      if (firstInvalidControl) {
        firstInvalidControl.focus();

        if (status) {
          status.textContent =
            form.dataset.errorMessage ||
            'Lütfen işaretli alanları kontrol edin.';
          status.dataset.state = 'error';
        }

        return;
      }

      const detail = {
        form,
        values: serializeForm(form)
      };

      form.dispatchEvent(
        new CustomEvent('cognilink:form-valid', {
          bubbles: true,
          detail
        })
      );

      if (status && form.dataset.successMessage) {
        status.textContent = form.dataset.successMessage;
        status.dataset.state = 'success';
      }
    });
  };

  const init = (root = document) => {
    root.querySelectorAll(FORM_SELECTOR).forEach(initForm);
  };

  document.addEventListener('DOMContentLoaded', () => init());

  window.CogniLinkForms = Object.freeze({
    init,
    validators,
    serializeForm
  });
})();


/* ================================================================
   COGNILINK SHARED VISUAL SYSTEM v1 interactions
   ================================================================ */
(() => {
  'use strict';

  const initFaq = (faq) => {
    if (faq.dataset.faqReady === 'true') return;
    faq.dataset.faqReady = 'true';

    const items = [...faq.querySelectorAll('details')];
    if (!items.length) return;

    items.forEach((item, index) => {
      item.open = index === 0;

      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });

      [...item.children].forEach((child) => {
        if (child.tagName === 'SUMMARY') return;
        child.addEventListener('click', () => {
          item.open = false;
        });
      });
    });
  };

const initTestimonial = (system) => {
  if (system.dataset.testimonialReady === 'true') return;

  system.dataset.testimonialReady = 'true';

  const slides = [
    ...system.querySelectorAll('[data-testimonial-slide]')
  ];

  if (!slides.length) return;

  const indicatorContainer =
    system.querySelector('[data-testimonial-indicators]') ||
    system.querySelector('.testimonial-indicators');

  if (!indicatorContainer) return;

  const duration = Number(system.dataset.duration || 7000);

  const reducedMotion = window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .matches;

  let activeIndex = 0;
  let timer = null;
  let animationFrame = null;
  let startedAt = 0;


  /* ---------------------------------
     Indicators
  --------------------------------- */

  indicatorContainer.innerHTML = '';

  const indicators = slides.map((_, index) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'testimonial-indicator';
    button.dataset.testimonialIndicator = '';
    button.setAttribute('aria-label', \`\${index + 1}. yorumu göster\`);
    button.setAttribute('aria-current', 'false');

    indicatorContainer.appendChild(button);

    return button;
  });


  /* ---------------------------------
     Timer control
  --------------------------------- */

  const stopTimer = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };


  /* ---------------------------------
     Loader animation
  --------------------------------- */

  const updateLoader = () => {
    if (reducedMotion || slides.length < 2) return;

    const elapsed = performance.now() - startedAt;
    const progress = Math.min(1, elapsed / duration);

    const activeIndicator = indicators[activeIndex];

    if (activeIndicator) {
      activeIndicator.style.setProperty(
        '--testimonial-progress',
        \`\${progress * 100}%\`
      );
    }

    if (progress < 1) {
      animationFrame =
        window.requestAnimationFrame(updateLoader);
    }
  };


  /* ---------------------------------
     Show slide
  --------------------------------- */

  const showSlide = (index, restartTimer = true) => {
    stopTimer();

    activeIndex =
      (index + slides.length) % slides.length;


    slides.forEach((slide, slideIndex) => {
      slide.setAttribute(
        'aria-hidden',
        slideIndex === activeIndex
          ? 'false'
          : 'true'
      );
    });


    indicators.forEach((indicator, indicatorIndex) => {
      const isActive =
        indicatorIndex === activeIndex;

      indicator.setAttribute(
        'aria-current',
        isActive ? 'true' : 'false'
      );

      indicator.style.removeProperty(
        '--testimonial-progress'
      );
    });


    if (
      restartTimer &&
      !reducedMotion &&
      slides.length > 1
    ) {
      startedAt = performance.now();

      animationFrame =
        window.requestAnimationFrame(updateLoader);

      timer = window.setTimeout(() => {
        showSlide(activeIndex + 1);
      }, duration);
    }
  };


  /* ---------------------------------
     Manual navigation
  --------------------------------- */

  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      showSlide(index);
    });
  });


  /* ---------------------------------
     Initial state
  --------------------------------- */

  showSlide(0);


  /* ---------------------------------
     Tab visibility
  --------------------------------- */

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        stopTimer();
      } else {
        showSlide(activeIndex);
      }
    }
  );
};

  const initSharedVisualSystem = (root = document) => {
    root.querySelectorAll('.faq').forEach(initFaq);
    root.querySelectorAll('[data-testimonial-system]').forEach(initTestimonial);
  };

  document.addEventListener('DOMContentLoaded', () => initSharedVisualSystem());

  window.CogniLinkVisualSystem = Object.freeze({
    init: initSharedVisualSystem
  });
})();
document.addEventListener('cognilink:form-valid', function (e) {
  const form = e.detail.form;
  const data = e.detail.values;
  const submitBtn = form.querySelector('button[type="submit"]');
  const statusEl = form.querySelector('[data-form-status]') || form.querySelector('.form-status');
  // Butonu devre dışı bırakıp yükleniyor durumu gösterelim
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gönderiliyor...';
  }
  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(res => {
    if (res.ok) {
      // Başarılıysa yönlendirme yap (_redirect input'undan adresi al)
      const redirectUrl = data._redirect || '/tesekkurler';
      window.location.href = redirectUrl;
    } else {
      throw new Error(res.error || "Geçersiz format");
    }
  })
  .catch(err => {
    if (statusEl) {
      statusEl.textContent = 'Bir hata oluştu, lütfen tekrar deneyin.';
      statusEl.dataset.state = 'error';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Teklifimi Al';
    }
  });
});`;
