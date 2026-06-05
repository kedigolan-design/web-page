(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const statusEl = document.getElementById('status');

  const state = {
    a: null,
    b: null,
    op: null,
    overwrite: true,
    lastError: null
  };

  function setStatus(text){
    if(!statusEl) return;
    statusEl.textContent = text;
  }

  function normalizeNumberString(s){
    // avoid "00" like states; keep "0" and decimals
    if(s === '' || s === '-') return '0';
    if(s === '-0') return '0';
    return s;
  }

  function getCurrentValue(){
    if(state.overwrite) return '0';
    if(state.b !== null) return String(state.b);
    return state.a !== null ? String(state.a) : '0';
  }

  function render(){
    let exp = '';
    if(state.a !== null) exp += state.a;
    if(state.op) {
      exp += ` ${opSymbol(state.op)} `;
      if(state.overwrite) {
        exp += '';
      } else {
        exp += state.b !== null ? state.b : '';
      }
    }

    expressionEl.textContent = exp.trim() || '\u00A0';
    resultEl.textContent = formatResult(state.overwrite ? '0' : getCurrentValue());
  }

  function formatResult(v){
    if(v === null || v === undefined) return '0';
    if(typeof v === 'number'){
      if(!Number.isFinite(v)) return 'Error';
      // Remove long float tail
      const s = String(v);
      if(s.includes('e')) return v.toString();
      const asNum = Number(v);
      return Number.isInteger(asNum) ? String(asNum) : asNum.toPrecision(12).replace(/\.0+$/,'').replace(/(\.\d+?)0+$/,'$1');
    }
    return String(v);
  }

  function opSymbol(op){
    switch(op){
      case '*': return '×';
      case '/': return '÷';
      case '+': return '+';
      case '-': return '−';
      default: return op;
    }
  }

  function clearAll(){
    state.a = null;
    state.b = null;
    state.op = null;
    state.overwrite = true;
    state.lastError = null;
    setStatus('Ready');
    render();
  }

  function deleteDigit(){
    setStatus('Editing');
    if(state.lastError){
      clearAll();
      return;
    }

    if(state.op === null){
      // no operator yet; allow editing a (or initial overwrite)
      state.a = null;
      state.overwrite = true;
      render();
      return;
    }

    // editing b
    if(state.overwrite){
      // if we haven't started typing b yet
      render();
      return;
    }

    const s = String(state.b ?? '0');
    if(s.length <= 1 || (s.length === 2 && s.startsWith('-'))){
      state.b = 0;
      render();
      return;
    }
    state.b = Number(s.slice(0, -1));
    if(Object.is(state.b, -0)) state.b = 0;
    render();
  }

  function inputDigit(d){
    if(state.lastError){
      clearAll();
    }

    setStatus('Typing');

    if(state.op === null){
      // typing a
      if(state.overwrite || state.a === null){
        state.a = Number(d);
        state.overwrite = false;
      } else {
        state.a = Number(String(state.a) + d);
      }
    } else {
      // typing b
      if(state.overwrite || state.b === null){
        state.b = Number(d);
        state.overwrite = false;
      } else {
        state.b = Number(String(state.b) + d);
      }
    }

    render();
  }

  function inputDot(){
    if(state.lastError){
      clearAll();
    }

    setStatus('Typing');

    if(state.op === null){
      if(state.overwrite || state.a === null){
        state.a = 0;
        state.overwrite = false;
      }
      const s = String(state.a);
      if(s.includes('.')) return;
      state.a = Number(s + '.');
    } else {
      if(state.overwrite || state.b === null){
        state.b = 0;
        state.overwrite = false;
      }
      const s = String(state.b);
      if(s.includes('.')) return;
      state.b = Number(s + '.');
    }

    render();
  }

  function compute(a, op, b){
    switch(op){
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return NaN;
    }
  }

  function inputOperator(nextOp){
    setStatus('Operator');

    // If no a yet, allow operator only after first number
    if(state.a === null){
      state.op = nextOp;
      render();
      return;
    }

    // If already have op and b typed, compute first
    if(state.op !== null && state.b !== null && state.overwrite === false){
      const res = compute(Number(state.a), state.op, Number(state.b));
      if(!Number.isFinite(res)){
        state.lastError = true;
        state.a = null;
        state.b = null;
        state.op = null;
        state.overwrite = true;
        resultEl.textContent = 'Error';
        expressionEl.textContent = '';
        setStatus('Error');
        return;
      }
      state.a = res;
      state.b = null;
      state.overwrite = true;
    }

    state.op = nextOp;
    state.overwrite = true;
    render();
  }

  function equals(){
    setStatus('Calculating');

    if(state.op === null || state.a === null){
      render();
      setStatus('Ready');
      return;
    }

    const b = state.overwrite ? 0 : (state.b ?? 0);
    const res = compute(Number(state.a), state.op, Number(b));

    if(!Number.isFinite(res)){
      state.lastError = true;
      resultEl.textContent = 'Error';
      expressionEl.textContent = '';
      setStatus('Error');
      return;
    }

    state.a = res;
    state.b = null;
    state.op = null;
    state.overwrite = true;
    render();
    setStatus('Done');
  }

  function handleAction(action, value){
    switch(action){
      case 'clear': return clearAll();
      case 'delete': return deleteDigit();
      case 'digit': return inputDigit(value);
      case 'dot': return inputDot();
      case 'op': return inputOperator(value);
      case 'equals': return equals();
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const action = btn.getAttribute('data-action');
    const value = btn.getAttribute('data-value');
    handleAction(action, value);
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    const key = e.key;

    // Prevent page shortcuts only for calculator keys
    const allowed = ['0','1','2','3','4','5','6','7','8','9','+','-','*','/','.','Enter','=','Backspace','Escape'];
    if(!allowed.includes(key)) return;

    e.preventDefault();

    if(key >= '0' && key <= '9') return handleAction('digit', key);
    if(key === '.') return handleAction('dot');
    if(key === '+') return handleAction('op', '+');
    if(key === '-') return handleAction('op', '-');
    if(key === '*') return handleAction('op', '*');
    if(key === '/') return handleAction('op', '/');
    if(key === 'Enter' || key === '=') return handleAction('equals');
    if(key === 'Backspace') return handleAction('delete');
    if(key === 'Escape') return handleAction('clear');
  });

  // init
  clearAll();
})();

