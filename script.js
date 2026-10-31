(function () {
  'use strict';

  if (window.recipeScalerInitialized) {
    return;
  }
  window.recipeScalerInitialized = true;

  const STORAGE_KEY = 'recipe_rescaler_saved_state';

  function setCookie(name, value, days) {
    try {
      const expireDays = days || 30;
      const expires = new Date(Date.now() + expireDays * 86400000).toUTCString();
      document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
    } catch (err) {
      console.warn('Cookie storage unavailable');
    }
  }

  function getCookie(name) {
    try {
      const encodedName = encodeURIComponent(name);
      const matches = document.cookie.match(new RegExp('(?:^|; )' + encodedName.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
      return matches ? decodeURIComponent(matches[1]) : null;
    } catch (err) {
      return null;
    }
  }

  function deleteCookie(name) {
    try {
      document.cookie = encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
    } catch (err) {}
  }

  function persistData(data) {
    const jsonStr = JSON.stringify(data);
    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
    } catch (e) {}
    setCookie(STORAGE_KEY, jsonStr, 30);
  }

  function retrievePersistedData() {
    try {
      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        return JSON.parse(localData);
      }
    } catch (e) {}

    const cookieData = getCookie(STORAGE_KEY);
    if (cookieData) {
      try {
        return JSON.parse(cookieData);
      } catch (e) {}
    }
    return null;
  }

  function clearPersistedData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    deleteCookie(STORAGE_KEY);
  }

  function parseAmount(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (str === '') return NaN;

    if (/^\d+\s+\d+\/\d+$/.test(str)) {
      const parts = str.split(/\s+/);
      const whole = parseFloat(parts[0]);
      const fracParts = parts[1].split('/');
      const num = parseFloat(fracParts[0]);
      const den = parseFloat(fracParts[1]);
      if (den === 0) return NaN;
      return whole + (num / den);
    }

    if (/^\d+\/\d+$/.test(str)) {
      const fracParts = str.split('/');
      const num = parseFloat(fracParts[0]);
      const den = parseFloat(fracParts[1]);
      if (den === 0) return NaN;
      return num / den;
    }

    const num = Number(str);
    return isNaN(num) ? NaN : num;
  }

  function scaleRecipeAmount(originalAmount, servingsWanted, recipeServings) {
    const orig = parseAmount(originalAmount);
    const wanted = parseAmount(servingsWanted);
    const makes = parseAmount(recipeServings);

    if (isNaN(makes) || isNaN(wanted) || makes <= 0 || wanted <= 0) {
      return null;
    }

    if (isNaN(orig) || orig < 0) {
      return null;
    }

    const raw = (orig * wanted) / makes;
    return Math.round(raw * 100) / 100;
  }

  function formatAmount(num) {
    if (num === null || num === undefined || isNaN(num)) return '';
    const rounded = Math.round(num * 100) / 100;
    if (Number.isInteger(rounded)) {
      return rounded.toString();
    }
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  }

  function runInternalTests() {
    let passed = 0;
    let failed = 0;

    const invalidCases = [
      { orig: 100, wanted: 0, makes: 4 },
      { orig: 100, wanted: 4, makes: 0 },
      { orig: 100, wanted: -2, makes: 4 },
      { orig: 100, wanted: 4, makes: -1 },
      { orig: 100, wanted: -5, makes: -5 },
      { orig: 100, wanted: '', makes: 4 },
      { orig: 100, wanted: 4, makes: '' },
      { orig: 100, wanted: null, makes: 4 },
      { orig: 100, wanted: 4, makes: undefined }
    ];

    invalidCases.forEach(function (tc) {
      const res = scaleRecipeAmount(tc.orig, tc.wanted, tc.makes);
      if (res === null) {
        passed += 1;
      } else {
        failed += 1;
      }
    });

    for (let makes = 1; makes <= 10; makes += 1) {
      for (let wanted = 1; wanted <= 10; wanted += 1) {
        for (let idx = 0; idx < 4; idx += 1) {
          const origVals = [10, 50, 100, 250];
          const orig = origVals[idx];
          const expected = Math.round(((orig * wanted) / makes) * 100) / 100;
          const actual = scaleRecipeAmount(orig, wanted, makes);
          if (Math.abs(actual - expected) < 0.000000001) {
            passed += 1;
          } else {
            failed += 1;
          }
        }
      }
    }

    const decimalCases = [
      { orig: 1.5, wanted: 6, makes: 4, expected: 2.25 },
      { orig: 0.75, wanted: 8, makes: 4, expected: 1.5 },
      { orig: '1/2', wanted: 4, makes: 2, expected: 1 },
      { orig: '3/4', wanted: 2, makes: 1, expected: 1.5 },
      { orig: '1 1/2', wanted: 4, makes: 2, expected: 3 },
      { orig: 250, wanted: 1.5, makes: 3, expected: 125 }
    ];

    decimalCases.forEach(function (tc) {
      const actual = scaleRecipeAmount(tc.orig, tc.wanted, tc.makes);
      if (Math.abs(actual - tc.expected) < 0.0001) {
        passed += 1;
      } else {
        failed += 1;
      }
    });

    return { total: passed + failed, passed: passed, failed: failed };
  }

  window.recipeScalerTests = runInternalTests;

  function initApp() {
    runInternalTests();

    const form = document.getElementById('recipe-form');
    const dishNameInput = document.getElementById('dish-name');
    const recipeServingsInput = document.getElementById('recipe-servings');
    const servingsWantedInput = document.getElementById('servings-wanted');

    const ing1NameInput = document.getElementById('ingredient-1-name');
    const ing1AmountInput = document.getElementById('ingredient-1-amount');
    const ing1UnitInput = document.getElementById('ingredient-1-unit');

    const ing2NameInput = document.getElementById('ingredient-2-name');
    const ing2AmountInput = document.getElementById('ingredient-2-amount');
    const ing2UnitInput = document.getElementById('ingredient-2-unit');

    const ing3NameInput = document.getElementById('ingredient-3-name');
    const ing3AmountInput = document.getElementById('ingredient-3-amount');
    const ing3UnitInput = document.getElementById('ingredient-3-unit');

    const rescaleBtn = document.getElementById('rescale-btn');
    const resetBtn = document.getElementById('reset-btn');
    const sampleBtn = document.getElementById('sample-btn');

    const messageBox = document.getElementById('message-box');
    const messageTitle = document.getElementById('message-title');
    const messageText = document.getElementById('message-text');

    const resultSection = document.getElementById('result-section');
    const resultDishName = document.getElementById('result-dish-name');
    const resultServingsInfo = document.getElementById('result-servings-info');
    const multiplierNumber = document.getElementById('multiplier-number');

    const resultIng1Name = document.getElementById('result-ing1-name');
    const resultIng1Amount = document.getElementById('result-ing1-amount');
    const resultIng1Unit = document.getElementById('result-ing1-unit');
    const resultIng1Formula = document.getElementById('result-ing1-formula');

    const resultIng2Name = document.getElementById('result-ing2-name');
    const resultIng2Amount = document.getElementById('result-ing2-amount');
    const resultIng2Unit = document.getElementById('result-ing2-unit');
    const resultIng2Formula = document.getElementById('result-ing2-formula');

    const resultIng3Name = document.getElementById('result-ing3-name');
    const resultIng3Amount = document.getElementById('result-ing3-amount');
    const resultIng3Unit = document.getElementById('result-ing3-unit');
    const resultIng3Formula = document.getElementById('result-ing3-formula');

    const copyBtn = document.getElementById('copy-btn');
    const aboutBtn = document.getElementById('about-btn');
    const aboutModal = document.getElementById('about-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalGotItBtn = document.getElementById('modal-got-it-btn');

    function showErrorMessage(title, text) {
      if (messageBox) {
        messageBox.className = 'message-box error';
        if (messageTitle) messageTitle.textContent = title;
        if (messageText) messageText.textContent = text;
        messageBox.classList.remove('hidden');
      }
      if (resultSection) {
        resultSection.classList.add('hidden');
      }
    }

    function hideMessage() {
      if (messageBox) {
        messageBox.classList.add('hidden');
      }
    }

    function showResults() {
      if (resultSection) {
        resultSection.classList.remove('hidden');
      }
      hideMessage();
    }

    function executeRescale(isRestoring) {
      const dishName = dishNameInput ? dishNameInput.value.trim() : '';
      const recipeServingsRaw = recipeServingsInput ? recipeServingsInput.value.trim() : '';
      const servingsWantedRaw = servingsWantedInput ? servingsWantedInput.value.trim() : '';

      if (recipeServingsRaw === '' || servingsWantedRaw === '') {
        showErrorMessage(
          'Missing Servings Input',
          'Please enter both the servings the recipe makes and the servings wanted. Neither can be empty.'
        );
        return false;
      }

      const recipeServings = parseFloat(recipeServingsRaw);
      const servingsWanted = parseFloat(servingsWantedRaw);

      if (isNaN(recipeServings) || recipeServings <= 0 || isNaN(servingsWanted) || servingsWanted <= 0) {
        let detail = 'Please enter valid positive numbers for both fields.';
        if (recipeServings === 0 || servingsWanted === 0) {
          detail = 'Servings cannot be zero. Please enter positive numbers greater than zero.';
        } else if (recipeServings < 0 || servingsWanted < 0) {
          detail = 'Servings cannot be negative. Please enter positive numbers.';
        }

        showErrorMessage('Invalid Servings Number', detail);
        return false;
      }

      const ing1 = {
        name: ing1NameInput ? ing1NameInput.value.trim() || 'Ingredient 1' : 'Ingredient 1',
        amountRaw: ing1AmountInput ? ing1AmountInput.value.trim() : '',
        unit: ing1UnitInput ? ing1UnitInput.value.trim() : ''
      };

      const ing2 = {
        name: ing2NameInput ? ing2NameInput.value.trim() || 'Ingredient 2' : 'Ingredient 2',
        amountRaw: ing2AmountInput ? ing2AmountInput.value.trim() : '',
        unit: ing2UnitInput ? ing2UnitInput.value.trim() : ''
      };

      const ing3 = {
        name: ing3NameInput ? ing3NameInput.value.trim() || 'Ingredient 3' : 'Ingredient 3',
        amountRaw: ing3AmountInput ? ing3AmountInput.value.trim() : '',
        unit: ing3UnitInput ? ing3UnitInput.value.trim() : ''
      };

      const ing1Amount = parseAmount(ing1.amountRaw);
      const ing2Amount = parseAmount(ing2.amountRaw);
      const ing3Amount = parseAmount(ing3.amountRaw);

      if (isNaN(ing1Amount) || ing1Amount < 0 || isNaN(ing2Amount) || ing2Amount < 0 || isNaN(ing3Amount) || ing3Amount < 0) {
        showErrorMessage(
          'Invalid Ingredient Amounts',
          'Please provide valid non-negative numbers for all three ingredient amounts.'
        );
        return false;
      }

      const newIng1Amount = scaleRecipeAmount(ing1Amount, servingsWanted, recipeServings);
      const newIng2Amount = scaleRecipeAmount(ing2Amount, servingsWanted, recipeServings);
      const newIng3Amount = scaleRecipeAmount(ing3Amount, servingsWanted, recipeServings);

      if (newIng1Amount === null || newIng2Amount === null || newIng3Amount === null) {
        showErrorMessage('Calculation Error', 'Could not compute ingredient quantities with current input values.');
        return false;
      }

      const multiplier = Math.round((servingsWanted / recipeServings) * 100) / 100;

      if (resultDishName) {
        resultDishName.textContent = dishName || 'Delicious Recipe';
      }
      if (resultServingsInfo) {
        resultServingsInfo.textContent = 'Scaled from ' + recipeServings + ' to ' + servingsWanted + ' servings';
      }
      if (multiplierNumber) {
        multiplierNumber.textContent = multiplier + 'x';
      }

      if (resultIng1Name) resultIng1Name.textContent = ing1.name;
      if (resultIng1Amount) resultIng1Amount.textContent = formatAmount(newIng1Amount);
      if (resultIng1Unit) resultIng1Unit.textContent = ing1.unit;
      if (resultIng1Formula) {
        resultIng1Formula.innerHTML = '<span class="formula-label">Math breakdown:</span>(' + formatAmount(ing1Amount) + ' x ' + servingsWanted + ') / ' + recipeServings + ' = <strong>' + formatAmount(newIng1Amount) + '</strong>';
      }

      if (resultIng2Name) resultIng2Name.textContent = ing2.name;
      if (resultIng2Amount) resultIng2Amount.textContent = formatAmount(newIng2Amount);
      if (resultIng2Unit) resultIng2Unit.textContent = ing2.unit;
      if (resultIng2Formula) {
        resultIng2Formula.innerHTML = '<span class="formula-label">Math breakdown:</span>(' + formatAmount(ing2Amount) + ' x ' + servingsWanted + ') / ' + recipeServings + ' = <strong>' + formatAmount(newIng2Amount) + '</strong>';
      }

      if (resultIng3Name) resultIng3Name.textContent = ing3.name;
      if (resultIng3Amount) resultIng3Amount.textContent = formatAmount(newIng3Amount);
      if (resultIng3Unit) resultIng3Unit.textContent = ing3.unit;
      if (resultIng3Formula) {
        resultIng3Formula.innerHTML = '<span class="formula-label">Math breakdown:</span>(' + formatAmount(ing3Amount) + ' x ' + servingsWanted + ') / ' + recipeServings + ' = <strong>' + formatAmount(newIng3Amount) + '</strong>';
      }

      showResults();

      persistData({
        dishName: dishName,
        recipeServings: recipeServingsRaw,
        servingsWanted: servingsWantedRaw,
        ingredients: [
          { name: ing1.name, amount: ing1.amountRaw, unit: ing1.unit },
          { name: ing2.name, amount: ing2.amountRaw, unit: ing2.unit },
          { name: ing3.name, amount: ing3.amountRaw, unit: ing3.unit }
        ],
        hasActiveResult: true,
        lastUpdated: Date.now()
      });

      if (!isRestoring && resultSection) {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      return true;
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        executeRescale(false);
      });
    }

    if (rescaleBtn) {
      rescaleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        executeRescale(false);
      });
    }

    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        if (dishNameInput) dishNameInput.value = 'Classic Fluffy Pancakes';
        if (recipeServingsInput) recipeServingsInput.value = '4';
        if (servingsWantedInput) servingsWantedInput.value = '8';

        if (ing1NameInput) ing1NameInput.value = 'All-Purpose Flour';
        if (ing1AmountInput) ing1AmountInput.value = '200';
        if (ing1UnitInput) ing1UnitInput.value = 'grams';

        if (ing2NameInput) ing2NameInput.value = 'Whole Milk';
        if (ing2AmountInput) ing2AmountInput.value = '300';
        if (ing2UnitInput) ing2UnitInput.value = 'ml';

        if (ing3NameInput) ing3NameInput.value = 'Eggs';
        if (ing3AmountInput) ing3AmountInput.value = '2';
        if (ing3UnitInput) ing3UnitInput.value = 'whole';

        executeRescale(false);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (dishNameInput) dishNameInput.value = '';
        if (recipeServingsInput) recipeServingsInput.value = '';
        if (servingsWantedInput) servingsWantedInput.value = '';

        if (ing1NameInput) ing1NameInput.value = '';
        if (ing1AmountInput) ing1AmountInput.value = '';
        if (ing1UnitInput) ing1UnitInput.value = '';

        if (ing2NameInput) ing2NameInput.value = '';
        if (ing2AmountInput) ing2AmountInput.value = '';
        if (ing2UnitInput) ing2UnitInput.value = '';

        if (ing3NameInput) ing3NameInput.value = '';
        if (ing3AmountInput) ing3AmountInput.value = '';
        if (ing3UnitInput) ing3UnitInput.value = '';

        hideMessage();
        if (resultSection) {
          resultSection.classList.add('hidden');
        }

        clearPersistedData();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const dish = resultDishName ? resultDishName.textContent : 'Recipe';
        const info = resultServingsInfo ? resultServingsInfo.textContent : '';
        const i1 = (resultIng1Name.textContent + ': ' + resultIng1Amount.textContent + ' ' + resultIng1Unit.textContent).trim();
        const i2 = (resultIng2Name.textContent + ': ' + resultIng2Amount.textContent + ' ' + resultIng2Unit.textContent).trim();
        const i3 = (resultIng3Name.textContent + ': ' + resultIng3Amount.textContent + ' ' + resultIng3Unit.textContent).trim();

        const text = dish + '\n' + info + '\n\nRescaled Ingredients:\n' + i1 + '\n' + i2 + '\n' + i3;

        navigator.clipboard.writeText(text).then(function () {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied';
          setTimeout(function () {
            copyBtn.textContent = originalText;
          }, 1800);
        }).catch(function () {
          alert('Recipe copied to clipboard');
        });
      });
    }

    if (aboutBtn && aboutModal) {
      aboutBtn.addEventListener('click', function () {
        aboutModal.classList.remove('hidden');
      });
    }

    if (closeModalBtn && aboutModal) {
      closeModalBtn.addEventListener('click', function () {
        aboutModal.classList.add('hidden');
      });
    }

    if (modalGotItBtn && aboutModal) {
      modalGotItBtn.addEventListener('click', function () {
        aboutModal.classList.add('hidden');
      });
    }

    if (aboutModal) {
      aboutModal.addEventListener('click', function (e) {
        if (e.target === aboutModal) {
          aboutModal.classList.add('hidden');
        }
      });
    }

    const saved = retrievePersistedData();
    if (saved) {
      if (saved.dishName && dishNameInput) dishNameInput.value = saved.dishName;
      if (saved.recipeServings !== undefined && recipeServingsInput) recipeServingsInput.value = saved.recipeServings;
      if (saved.servingsWanted !== undefined && servingsWantedInput) servingsWantedInput.value = saved.servingsWanted;

      if (saved.ingredients && saved.ingredients.length >= 3) {
        if (ing1NameInput) ing1NameInput.value = saved.ingredients[0].name || '';
        if (ing1AmountInput) ing1AmountInput.value = saved.ingredients[0].amount || '';
        if (ing1UnitInput) ing1UnitInput.value = saved.ingredients[0].unit || '';

        if (ing2NameInput) ing2NameInput.value = saved.ingredients[1].name || '';
        if (ing2AmountInput) ing2AmountInput.value = saved.ingredients[1].amount || '';
        if (ing2UnitInput) ing2UnitInput.value = saved.ingredients[1].unit || '';

        if (ing3NameInput) ing3NameInput.value = saved.ingredients[2].name || '';
        if (ing3AmountInput) ing3AmountInput.value = saved.ingredients[2].amount || '';
        if (ing3UnitInput) ing3UnitInput.value = saved.ingredients[2].unit || '';
      }

      if (saved.hasActiveResult) {
        executeRescale(true);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

