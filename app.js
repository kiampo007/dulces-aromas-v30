// ============================================================
// POS DULCES AROMAS - v2026.05.11-corregido
// 15 fixes criticos aplicados - NO MODIFICAR ESTRUCTURA VISUAL
// ============================================================

// FIX #14: Loggear precios undefined para debugging
function formatMoney(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) {
        if (amount !== undefined) console.warn('formatMoney: valor invalido', amount);
        return '$0';
    }
    return '$' + Math.round(amount).toLocaleString('es-CL');
}

function formatDate(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CL');
}

function formatDateTime(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
}

function now() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + 
           String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
}

// FIX #17: ID unico con counter + random fuerte para evitar colisiones multi-pestaña
var idCounter = 0;
function generateId() {
    idCounter = (idCounter + 1) % 10000;
    var randomPart = '';
    for (var i = 0; i < 4; i++) {
        randomPart += Math.floor(Math.random() * 36).toString(36);
    }
    return Date.now().toString(36) + idCounter.toString(36).padStart(4,'0') + randomPart;
}

// FIX #13: Toast con clearTimeout para evitar acumulacion
var toastTimeout = null;
function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

// FIX #1: Escape HTML completo con backticks y slash
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/`/g, "&#96;")
        .replace(/\//g, "&#x2F;")
        .replace(/\x00/g, '')
        .replace(/\x0b/g, '')
        .replace(/\x0c/g, '');
}

function normalizarPrecio(valor) {
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
        var limpio = valor.replace(/\./g, '').replace(/,/g, '.');
        var num = parseFloat(limpio);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}

// FIX #15: Manejo de errores mejorado en redimensionarImagen
function redimensionarImagen(base64, maxWidth, maxHeight, callback) {
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var width = img.width, height = img.height;
        if (width > height) { if (width > maxWidth) { height *= maxWidth/width; width = maxWidth; }}
        else { if (height > maxHeight) { width *= maxHeight/height; height = maxHeight; }}
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function() { 
        showToast('Error: imagen corrupta o no soportada');
        callback(null); 
    };
    img.src = base64;
}

// ============================================================
// ALMACENAMIENTO
// ============================================================
var Store = {
    get: function(key) {
        try { var data = localStorage.getItem('da_' + key); return data ? JSON.parse(data) : null; }
        catch(e) { console.error('Error leyendo ' + key + ':', e); return null; }
    },
    set: function(key, value) {
        try {
            var json = JSON.stringify(value);
            if (json.length > 4 * 1024 * 1024) { showToast('Datos muy grandes. Exporta backup.'); return false; }
            localStorage.setItem('da_' + key, json);
            return true;
        } catch(e) {
            if (e.name === 'QuotaExceededError') showToast('⚠️ Almacenamiento lleno. Exporta backup.');
            else showToast('Error guardando: ' + e.message);
            return false;
        }
    }
};

function guardarTodo(data) {
    try {
        var json = JSON.stringify(data);
        if (json.length > 5 * 1024 * 1024) { showToast('Datos muy grandes. Exporta backup.'); return false; }
        // FIX #18: Backup temporal antes de sobrescribir
        try {
            localStorage.setItem('da_todo_backup', localStorage.getItem('da_todo') || '');
        } catch(e) {}
        localStorage.setItem('da_todo', json);
        // Invalidar cache
        _cacheData = null;
        _cacheTimestamp = 0;
        return true;
    } catch(e) {
        if (e.name === 'QuotaExceededError') showToast('⚠️ Almacenamiento lleno. Exporta backup.');
        else showToast('Error guardando: ' + e.message);
        return false;
    }
}

// FIX #5: Carga atomica + limpieza de keys antiguas migradas
var _cacheData = null;
var _cacheTimestamp = 0;
var CACHE_TTL = 500;

function cargarTodo() {
    var now = Date.now();
    if (_cacheData && (now - _cacheTimestamp) < CACHE_TTL) {
        return _cacheData;
    }
    try {
        var todo = localStorage.getItem('da_todo');
        if (todo) {
            var parsed = JSON.parse(todo);
            var result = {
                productos: parsed.productos || [],
                ventas: parsed.ventas || [],
                clientes: parsed.clientes || [],
                deudas: parsed.deudas || [],
                movimientos: parsed.movimientos || []
            };
            _cacheData = result;
            _cacheTimestamp = now;
            return result;
        }
        // Migracion desde formato antiguo
        var data = {
            productos: Store.get('productos') || [],
            ventas: Store.get('ventas') || [],
            clientes: Store.get('clientes') || [],
            deudas: Store.get('deudas') || [],
            movimientos: Store.get('movimientos') || []
        };
        // Guardar en nuevo formato y limpiar viejo
        if (guardarTodo(data)) {
            localStorage.removeItem('da_productos');
            localStorage.removeItem('da_ventas');
            localStorage.removeItem('da_clientes');
            localStorage.removeItem('da_deudas');
            localStorage.removeItem('da_movimientos');
        }
        _cacheData = data;
        _cacheTimestamp = now;
        return data;
    } catch(e) {
        console.error('Error cargando datos:', e);
        var fallback = {productos: [], ventas: [], clientes: [], deudas: [], movimientos: []};
        _cacheData = fallback;
        _cacheTimestamp = now;
        return fallback;
    }
}

function getProductos() { return cargarTodo().productos; }
function getVentas() { return cargarTodo().ventas; }
function getClientes() { return cargarTodo().clientes; }
function getDeudas() { return cargarTodo().deudas; }
function getMovimientos() { return cargarTodo().movimientos; }

var currentModule = 'dashboard';
var cart = [];
var editingProductId = null; fotoProductoBase64 = null; fotoProductoEditando = null;
var editingDeudaId = null;
var fotoProductoBase64 = null;
var fotoProductoEditando = null;
var fotoProductoBase64 = null;
var fotoProductoEditando = null;

// FIX #14: Validar carrito al restaurar (productos pueden haber cambiado)
function restaurarCarrito() {
    try {
        var guardado = sessionStorage.getItem('da_cart');
        if (!guardado) { cart = []; return; }
        var parsed = JSON.parse(guardado);
        var productos = getProductos();
        var cartValidado = [];
        for (var i = 0; i < parsed.length; i++) {
            var p = null;
            for (var j = 0; j < productos.length; j++) {
                if (productos[j].id === parsed[i].id) { p = productos[j]; break; }
            }
            if (p && p.stock > 0) {
                var qty = Math.min(parsed[i].qty, p.stock);
                if (qty > 0) cartValidado.push({id: parsed[i].id, nombre: p.nombre, precio: p.precio, qty: qty});
            }
        }
        cart = cartValidado;
        actualizarCarroUI();
    } catch(e) { cart = []; }
}

// FIX #19: Try-catch en guardarCarrito con fallback
function guardarCarrito() {
    try { 
        sessionStorage.setItem('da_cart', JSON.stringify(cart)); 
    } catch(e) {
        if (e.name === 'QuotaExceededError') {
            showToast('⚠️ Carrito muy grande. Vacía algunos items.');
        }
    }
}

function navigateTo(module) {
    var modules = document.querySelectorAll('.module');
    for (var i = 0; i < modules.length; i++) modules[i].classList.remove('active');
    var navBtns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < navBtns.length; i++) navBtns[i].classList.remove('active');
    var target = document.getElementById('mod-' + module);
    if (target) { target.classList.add('active'); currentModule = module; }
    var btns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('data-module') === module) btns[i].classList.add('active');
    }
    if (module === 'dashboard') updateDashboard();
    if (module === 'venta') renderVenta();
    if (module === 'productos') renderProductos();
    if (module === 'inventario') renderInventario();
    if (module === 'ventas') renderVentas();
    if (module === 'clientes') renderClientes();
    if (module === 'deudas') { renderDeudas(); renderHistorialDeudas(); }
    if (module === 'catalogo') renderCatalogo();
    if (module === 'config') { /* config no necesita render */ }
    var main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
    var cartPanel = document.getElementById('cart-panel');
    if (cartPanel) cartPanel.classList.remove('open');
}

function updateDashboard() {
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    var ventas = getVentas().filter(function(v) {
        var vFecha = new Date(v.fecha); vFecha.setHours(0,0,0,0);
        return vFecha.getTime() === hoy.getTime();
    });
    var totalHoy = ventas.reduce(function(s, v) { return s + (v.total || 0); }, 0);
    var stockBajo = getProductos().filter(function(p) { return p.stock <= (p.stockMinimo || 3); }).length;
    var deudasVencidas = getDeudas().filter(function(d) {
        if (d.estado !== 'activa') return false;
        if (!d.proxVencimiento) return false;
        var proxVenc = new Date(d.proxVencimiento); var hoyFecha = new Date(); hoyFecha.setHours(0,0,0,0);
        return proxVenc <= hoyFecha;
    }).length;
    var dashVentas = document.getElementById('dash-ventas');
    var dashStock = document.getElementById('dash-stock');
    var dashDeudas = document.getElementById('dash-deudas');
    var headerDate = document.getElementById('header-date');
    if (dashVentas) dashVentas.textContent = formatMoney(totalHoy);
    if (dashStock) dashStock.textContent = stockBajo;
    if (dashDeudas) dashDeudas.textContent = deudasVencidas;
    if (headerDate) headerDate.textContent = new Date().toLocaleDateString('es-CL', {weekday:'long', day:'numeric', month:'long'});
    var alertasContainer = document.getElementById('dash-alertas');
    var alertasCard = document.getElementById('dash-alertas-card');
    if (alertasContainer) {
        var hoyFecha = new Date(); hoyFecha.setHours(0,0,0,0);
        var alertas = [];
        var allDeudas = getDeudas().filter(function(d) { return d.estado === 'activa'; });
        var vencidasHoy = allDeudas.filter(function(d) {
            if (!d.proxVencimiento) return false;
            var venc = new Date(d.proxVencimiento);
            return venc <= hoyFecha;
        });
        if (vencidasHoy.length > 0) {
            alertas.push('<div class="dash-alerta rojo" onclick="navigateTo('deudas')">🔴 ' + vencidasHoy.length + ' cuota(s) vencida(s) hoy</div>');
        }
        var proximas = allDeudas.filter(function(d) {
            if (!d.proxVencimiento) return false;
            var venc = new Date(d.proxVencimiento);
            var diff = Math.ceil((venc - hoyFecha) / (1000*60*60*24));
            return diff > 0 && diff <= 3;
        });
        if (proximas.length > 0) {
            alertas.push('<div class="dash-alerta amarillo" onclick="navigateTo('deudas')">🟡 ' + proximas.length + ' cuota(s) vencen en 3 dias</div>');
        }
        var allClientes = getClientes();
        var clientesAlerta = [];
        for (var i = 0; i < allClientes.length; i++) {
            var limite = allClientes[i].limiteCredito || 0;
            if (limite > 0) {
                var deudasCli = allDeudas.filter(function(d) { return d.clienteId === allClientes[i].id; });
                var usado = deudasCli.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
                if ((usado / limite) > 0.8) {
                    clientesAlerta.push(escapeHtml(allClientes[i].nombre));
                }
            }
        }
        if (clientesAlerta.length > 0) {
            alertas.push('<div class="dash-alerta naranja" onclick="navigateTo('clientes')">🟠 ' + clientesAlerta.length + ' cliente(s) con >80% limite usado</div>');
        }
        alertasContainer.innerHTML = alertas.length > 0 ? alertas.join('') : '<div class="dash-alerta verde">✅ Sin alertas de deudas</div>';
        if (alertasCard) alertasCard.style.display = 'block';
    } else if (alertasCard) {
        alertasCard.style.display = 'none';
    }
}

// ============================================================
// VENTA
// ============================================================
function renderVenta() {
    var productos = getProductos().filter(function(p) { return p.stock > 0; });
    var container = document.getElementById('v-productos');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos con stock</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="v-foto">' : '<div class="v-foto-placeholder">🌸</div>';
        return '<div class="product-card" data-action="add-cart" data-id="' + escapeHtml(p.id) + '">' + fotoHtml +
            '<div class="v-nombre">' + escapeHtml(p.nombre) + '</div>' +
            '<div class="v-precio">' + formatMoney(p.precio) + '</div>' +
            '<div class="v-stock">Stock: ' + p.stock + '</div></div>';
    }).join('');
}

function buscarProducto() {
    var input = document.getElementById('v-buscar');
    if (!input) return;
    var query = input.value.toLowerCase().trim();
    var productos = getProductos().filter(function(p) { return p.stock > 0 && p.nombre.toLowerCase().indexOf(query) !== -1; });
    var container = document.getElementById('v-productos');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="v-foto">' : '<div class="v-foto-placeholder">🌸</div>';
        return '<div class="product-card" data-action="add-cart" data-id="' + escapeHtml(p.id) + '">' + fotoHtml +
            '<div class="v-nombre">' + escapeHtml(p.nombre) + '</div>' +
            '<div class="v-precio">' + formatMoney(p.precio) + '</div>' +
            '<div class="v-stock">Stock: ' + p.stock + '</div></div>';
    }).join('');
}

// FIX #6: filtrarCat usa data-cat en vez de textContent
function filtrarCat(cat) {
    var tabs = document.querySelectorAll('#mod-venta .tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-cat') === cat) {
            tabs[i].classList.add('active'); break;
        }
    }
    var productos = cat === 'todos' ? getProductos().filter(function(p) { return p.stock > 0; }) : 
        getProductos().filter(function(p) { return p.stock > 0 && p.categoria === cat; });
    var container = document.getElementById('v-productos');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="v-foto">' : '<div class="v-foto-placeholder">🌸</div>';
        return '<div class="product-card" data-action="add-cart" data-id="' + escapeHtml(p.id) + '">' + fotoHtml +
            '<div class="v-nombre">' + escapeHtml(p.nombre) + '</div>' +
            '<div class="v-precio">' + formatMoney(p.precio) + '</div>' +
            '<div class="v-stock">Stock: ' + p.stock + '</div></div>';
    }).join('');
}

function agregarAlCarro(id) {
    var productos = getProductos();
    var p = null;
    for (var i = 0; i < productos.length; i++) { if (productos[i].id === id) { p = productos[i]; break; } }
    if (!p || p.stock <= 0) { showToast('Sin stock'); return; }
    var existing = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].id === id) { existing = cart[i]; break; } }
    if (existing) {
        if (existing.qty >= p.stock) { showToast('Stock maximo'); return; }
        existing.qty++;
    } else {
        cart.push({id: id, nombre: p.nombre, precio: p.precio, qty: 1});
    }
    guardarCarrito();
    actualizarCarroUI();
    var cp = document.getElementById('cart-panel');
    if (cp && !cp.classList.contains('open')) toggleCart();
    showToast('Producto agregado');
}

function actualizarCarroUI() {
    var count = cart.reduce(function(s, c) { return s + c.qty; }, 0);
    var total = cart.reduce(function(s, c) { return s + (c.precio * c.qty); }, 0);
    var cartCount = document.getElementById('cart-count');
    var cartFab = document.getElementById('cart-fab');
    var cartTotal = document.getElementById('cart-total');
    var itemsDiv = document.getElementById('cart-items');
    if (cartCount) cartCount.textContent = count;
    if (cartFab) cartFab.style.display = count > 0 ? 'flex' : 'none';
    if (cartTotal) cartTotal.textContent = formatMoney(total);
    if (!itemsDiv) return;
    if (cart.length === 0) { itemsDiv.innerHTML = '<div class="empty">Carro vacio</div>'; return; }
    itemsDiv.innerHTML = cart.map(function(c, idx) {
        return '<div class="cart-item">' +
            '<div class="cart-item-info"><b>' + escapeHtml(c.nombre) + '</b><br>' + formatMoney(c.precio) + ' c/u</div>' +
            '<div class="cart-item-actions">' +
            '<button data-action="cart-minus" data-idx="' + idx + '">-</button>' +
            '<span>' + c.qty + '</span>' +
            '<button data-action="cart-plus" data-idx="' + idx + '">+</button></div>' +
            '<div class="cart-item-total">' + formatMoney(c.precio * c.qty) + '</div></div>';
    }).join('');
}

function sumarAlCarro(idx) {
    var productos = getProductos();
    var c = cart[idx]; if (!c) return;
    var p = null;
    for (var i = 0; i < productos.length; i++) { if (productos[i].id === c.id) { p = productos[i]; break; } }
    if (p && c.qty < p.stock) { c.qty++; guardarCarrito(); actualizarCarroUI(); }
    else { showToast('Stock maximo'); }
}

function restarDelCarro(idx) {
    if (!cart[idx]) return;
    if (cart[idx].qty > 1) cart[idx].qty--;
    else cart.splice(idx, 1);
    guardarCarrito();
    actualizarCarroUI();
}

function toggleCart() {
    var panel = document.getElementById('cart-panel');
    if (panel) panel.classList.toggle('open');
}

// ============================================================
// PAGAR - FIX #3: Transaccion atomica con re-verificacion
// ============================================================
function pagar(metodo) {
    if (cart.length === 0) { showToast('Carro vacio'); return; }

    var data = cargarTodo();
    var productos = data.productos;
    var ventas = data.ventas;
    var movimientos = data.movimientos;

    // FIX #3: Re-verificar stock DENTRO de la transaccion
    for (var i = 0; i < cart.length; i++) {
        var p = null;
        for (var j = 0; j < productos.length; j++) { if (productos[j].id === cart[i].id) { p = productos[j]; break; } }
        if (!p) { showToast('Producto no encontrado: ' + escapeHtml(cart[i].nombre)); return; }
        if (p.stock < cart[i].qty) { showToast('Stock insuficiente para: ' + escapeHtml(p.nombre) + ' (disponible: ' + p.stock + ')'); return; }
    }

    var total = cart.reduce(function(s, c) { return s + (c.precio * c.qty); }, 0);

    if (metodo === 'credito') {
        var clientes = data.clientes;
        if (clientes.length === 0) { showToast('Primero registra un cliente'); return; }
        var creditoTotal = document.getElementById('credito-total');
        var creditoCliente = document.getElementById('credito-cliente');
        if (creditoTotal) creditoTotal.textContent = formatMoney(total);
        if (creditoCliente) {
            creditoCliente.innerHTML = '<option value="">Seleccionar cliente...</option>' + 
                clientes.map(function(c) { return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.nombre) + '</option>'; }).join('');
        }
        document.getElementById('credito-cuotas').value = '1';
        actualizarCuotaPreview();
        showModal('modal-credito');
        return;
    }

    var venta = {
        id: generateId(),
        productos: cart.map(function(c) { return {id: c.id, nombre: c.nombre, precio: c.precio, qty: c.qty}; }),
        total: total, metodo: metodo, clienteId: null, numCuotas: 1, fecha: now()
    };
    ventas.unshift(venta);

    for (var i = 0; i < cart.length; i++) {
        for (var j = 0; j < productos.length; j++) { if (productos[j].id === cart[i].id) { productos[j].stock -= cart[i].qty; break; } }
    }

    for (var i = 0; i < cart.length; i++) {
        movimientos.unshift({id: generateId(), tipo: 'Venta', producto: cart[i].nombre, cantidad: -cart[i].qty, fecha: now()});
    }
    if (movimientos.length > 200) movimientos = movimientos.slice(0, 200);

    var ok = guardarTodo(data);

    if (ok) {
        guardarCarrito(); cart = []; actualizarCarroUI(); toggleCart();
        showToast('✅ Venta registrada: ' + formatMoney(total));
        updateDashboard();
        renderVenta(); renderProductos(); renderInventario(); renderCatalogo();
    } else {
        showToast('❌ Error al registrar venta. Carro preservado. Intenta de nuevo.');
    }
}

// FIX #4: Cuotas con vencimientos correctos (dia de compra, no siempre dia 1)
function confirmarCredito() {
    var clienteId = document.getElementById('credito-cliente').value;
    if (!clienteId) { showToast('Selecciona un cliente'); return; }
    var numCuotas = parseInt(document.getElementById('credito-cuotas').value) || 1;
    if (numCuotas < 1 || numCuotas > 12) { showToast('Cuotas entre 1 y 12'); return; }
    var total = cart.reduce(function(s, c) { return s + (c.precio * c.qty); }, 0);

    var data = cargarTodo();
    var productos = data.productos;
    var clientes = data.clientes;
    var deudas = data.deudas;
    var movimientos = data.movimientos;

    var cliente = null;
    for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { cliente = clientes[i]; break; } }

    // Validar limite de credito
    var deudasActivasCliente = deudas.filter(function(d) { return d.clienteId === clienteId && d.estado === 'activa'; });
    var totalDeudaActual = deudasActivasCliente.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var limite = cliente ? (cliente.limiteCredito || 0) : 0;
    if (limite > 0 && (totalDeudaActual + total) > limite) {
        if (!confirm('⚠️ Esta venta excede el limite de credito de ' + formatMoney(limite) + '.\nDeuda actual: ' + formatMoney(totalDeudaActual) + '\nNueva deuda: ' + formatMoney(total) + '\nTotal seria: ' + formatMoney(totalDeudaActual + total) + '\n\n¿Continuar de todos modos?')) {
            return;
        }
    }

    // FIX #3: Re-verificar stock
    for (var i = 0; i < cart.length; i++) {
        var p = null;
        for (var j = 0; j < productos.length; j++) { if (productos[j].id === cart[i].id) { p = productos[j]; break; } }
        if (!p || p.stock < cart[i].qty) { showToast('Stock insuficiente para: ' + escapeHtml(cart[i].nombre)); return; }
    }

    var valorCuotaBase = Math.floor(total / numCuotas);
    var ultimaCuota = Math.max(0, total - (valorCuotaBase * (numCuotas - 1)));

    // FIX #4: Vencimientos respetan dia de compra y manejan overflow de meses
    var hoy = new Date();
    var diaCompra = hoy.getDate();
    var vencimientos = [];
    for (var i = 1; i <= numCuotas; i++) {
        var venc = new Date(hoy.getFullYear(), hoy.getMonth() + i, diaCompra);
        // Si el dia no existe en ese mes (ej: 31 de febrero), va al ultimo dia del mes
        if (venc.getDate() !== diaCompra) {
            venc = new Date(venc.getFullYear(), venc.getMonth(), 0);
        }
        // FIX #15: Guardar en formato local YYYY-MM-DD para evitar problemas de timezone
        var yyyy = venc.getFullYear();
        var mm = String(venc.getMonth() + 1).padStart(2, '0');
        var dd = String(venc.getDate()).padStart(2, '0');
        vencimientos.push(yyyy + '-' + mm + '-' + dd + 'T00:00:00.000Z');
    }

    var deuda = {
        id: generateId(), clienteId: clienteId, clienteNombre: cliente ? cliente.nombre : 'Desconocido',
        total: total, saldoPendiente: total, numCuotasTotal: numCuotas, cuotasPagadas: 0, totalPagado: 0,
        valorCuota: valorCuotaBase, ultimaCuotaValor: ultimaCuota, estado: 'activa', fecha: now(),
        proxVencimiento: vencimientos[0], vencimientos: vencimientos, pagos: []
    };
    var venta = {
        id: generateId(),
        productos: cart.map(function(c) { return {id: c.id, nombre: c.nombre, precio: c.precio, qty: c.qty}; }),
        total: total, metodo: 'credito', clienteId: clienteId, numCuotas: numCuotas, fecha: now()
    };

    for (var i = 0; i < cart.length; i++) {
        for (var j = 0; j < productos.length; j++) { if (productos[j].id === cart[i].id) { productos[j].stock -= cart[i].qty; break; } }
    }

    data.ventas.unshift(venta);
    deudas.unshift(deuda);

    for (var i = 0; i < cart.length; i++) {
        movimientos.unshift({id: generateId(), tipo: 'Venta Fiado', producto: cart[i].nombre, cantidad: -cart[i].qty, fecha: now()});
    }
    if (movimientos.length > 200) movimientos = movimientos.slice(0, 200);

    var ok = guardarTodo(data);

    if (ok) {
        guardarCarrito(); cart = []; actualizarCarroUI(); toggleCart(); closeModal('modal-credito');
        showToast('✅ Fiado registrado: ' + formatMoney(total) + ' en ' + numCuotas + ' cuota(s)');
        updateDashboard();
    } else {
        showToast('❌ Error al registrar fiado. Carro preservado.');
    }
}

// FIX #11: Manejar carrito vacio en preview de cuotas
function actualizarCuotaPreview() {
    var total = cart.reduce(function(s, c) { return s + (c.precio * c.qty); }, 0);
    var numCuotas = parseInt(document.getElementById('credito-cuotas').value) || 1;
    if (numCuotas < 1) numCuotas = 1; if (numCuotas > 12) numCuotas = 12;
    document.getElementById('credito-cuotas').value = numCuotas;
    var preview = document.getElementById('cuota-preview');
    if (!preview) return;
    if (total === 0) {
        preview.textContent = 'Agrega productos al carro primero';
        return;
    }
    var valorBase = Math.floor(total / numCuotas);
    var ultima = Math.max(0, total - (valorBase * (numCuotas - 1)));
    if (numCuotas === 1) preview.textContent = '1 pago de ' + formatMoney(total);
    else preview.textContent = (numCuotas - 1) + ' cuotas de ' + formatMoney(valorBase) + ' + ultima de ' + formatMoney(ultima);
}

function cargarFotoProducto(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Imagen muy grande. Max 5MB'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        showToast('Procesando imagen...');
        redimensionarImagen(e.target.result, 800, 800, function(resized) {
            if (!resized) { showToast('Error al procesar imagen'); return; }
            fotoProductoBase64 = resized;
            var preview = document.getElementById('prod-foto-img');
            var previewDiv = document.getElementById('prod-foto-preview');
            if (preview) preview.src = fotoProductoBase64;
            if (previewDiv) previewDiv.style.display = 'block';
            showToast('Foto cargada (' + Math.round(resized.length / 1024) + 'KB)');
        });
    };
    reader.onerror = function() { showToast('Error al leer imagen'); };
    reader.readAsDataURL(file);
    input.value = '';
}

function cargarFotoProducto(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Imagen muy grande. Max 5MB'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        showToast('Procesando imagen...');
        redimensionarImagen(e.target.result, 800, 800, function(resized) {
            if (!resized) { showToast('Error al procesar imagen'); return; }
            fotoProductoBase64 = resized;
            var preview = document.getElementById('prod-foto-img');
            var previewDiv = document.getElementById('prod-foto-preview');
            if (preview) preview.src = fotoProductoBase64;
            if (previewDiv) previewDiv.style.display = 'block';
            showToast('Foto cargada (' + Math.round(resized.length / 1024) + 'KB)');
        });
    };
    reader.onerror = function() { showToast('Error al leer imagen'); };
    reader.readAsDataURL(file);
    input.value = '';
}

// ============================================================
// PRODUCTOS
// ============================================================
function renderProductos() {
    var productos = getProductos();
    var container = document.getElementById('p-lista');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="p-foto">' : 
            '<div class="p-foto-placeholder">🌸</div>';
        return '<div class="producto-item">' +
            '<div class="p-left">' + fotoHtml + '</div>' +
            '<div class="p-info"><b>' + escapeHtml(p.nombre) + '</b><br>' + escapeHtml(p.marca || 'Sin marca') + ' | Stock: ' + p.stock + ' | ' + escapeHtml(p.categoria) + '</div>' +
            '<div class="p-actions">' +
            '<span class="p-precio">' + formatMoney(p.precio) + '</span>' +
            '<button data-action="edit-prod" data-id="' + escapeHtml(p.id) + '">✏️</button>' +
            '<button data-action="del-prod" data-id="' + escapeHtml(p.id) + '">🗑️</button></div></div>';
    }).join('');
}

function filtrarProductos() {
    var input = document.getElementById('p-buscar');
    if (!input) return;
    var query = input.value.toLowerCase().trim();
    var productos = getProductos().filter(function(p) { return p.nombre.toLowerCase().indexOf(query) !== -1; });
    var container = document.getElementById('p-lista');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="p-foto">' : 
            '<div class="p-foto-placeholder">🌸</div>';
        return '<div class="producto-item">' +
            '<div class="p-left">' + fotoHtml + '</div>' +
            '<div class="p-info"><b>' + escapeHtml(p.nombre) + '</b><br>' + escapeHtml(p.marca || 'Sin marca') + ' | Stock: ' + p.stock + ' | ' + escapeHtml(p.categoria) + '</div>' +
            '<div class="p-actions">' +
            '<span class="p-precio">' + formatMoney(p.precio) + '</span>' +
            '<button data-action="edit-prod" data-id="' + escapeHtml(p.id) + '">✏️</button>' +
            '<button data-action="del-prod" data-id="' + escapeHtml(p.id) + '">🗑️</button></div></div>';
    }).join('');
}

function showModalProducto() {
    editingProductId = null; fotoProductoBase64 = null; fotoProductoEditando = null; fotoProductoBase64 = null; fotoProductoEditando = null;
    var nombre = document.getElementById('prod-nombre');
    var marca = document.getElementById('prod-marca');
    var precio = document.getElementById('prod-precio');
    var stock = document.getElementById('prod-stock');
    var cat = document.getElementById('prod-cat');
    var preview = document.getElementById('prod-foto-preview');
    var img = document.getElementById('prod-foto-img');
    var title = document.getElementById('modal-producto-title');

    if (nombre) nombre.value = '';
    if (marca) marca.value = '';
    if (precio) precio.value = '';
    if (stock) stock.value = '';
    if (cat) cat.value = 'caballero';
    if (preview) preview.style.display = 'none';
    if (img) img.src = '';
    if (title) title.textContent = 'Nuevo Producto';
    showModal('modal-producto');
}

function editarProducto(id) {
    var data = cargarTodo();
    var productos = data.productos;
    var p = null;
    for (var i = 0; i < productos.length; i++) { if (productos[i].id === id) { p = productos[i]; break; } }
    if (!p) return;
    editingProductId = id;
    fotoProductoEditando = p.foto || null;
    fotoProductoBase64 = null;

    var nombre = document.getElementById('prod-nombre');
    var marca = document.getElementById('prod-marca');
    var precio = document.getElementById('prod-precio');
    var stock = document.getElementById('prod-stock');
    var cat = document.getElementById('prod-cat');
    var preview = document.getElementById('prod-foto-preview');
    var img = document.getElementById('prod-foto-img');
    var title = document.getElementById('modal-producto-title');

    if (nombre) nombre.value = p.nombre;
    if (marca) marca.value = p.marca || '';
    if (precio) precio.value = p.precio;
    if (stock) stock.value = p.stock;
    if (cat) cat.value = p.categoria || 'caballero';
    fotoProductoEditando = p.foto || null;
    fotoProductoBase64 = null;
    if (p.foto && img && preview) {
        img.src = p.foto;
        preview.style.display = 'block';
    } else if (preview) {
        preview.style.display = 'none';
    }
    if (title) title.textContent = 'Editar Producto';
    showModal('modal-producto');
}

// FIX #17: Sanitizacion de nombres con trim()
function guardarProducto() {
    var nombre = document.getElementById('prod-nombre').value.trim();
    var precioInput = document.getElementById('prod-precio').value;
    var precio = normalizarPrecio(precioInput);
    var stock = parseInt(document.getElementById('prod-stock').value) || 0;
    if (!nombre) { showToast('Nombre obligatorio'); return; }
    if (precio <= 0) { showToast('Precio debe ser mayor a 0'); return; }
    // FIX #3: Validar que stock no quede negativo
    if (stock < 0) { showToast('Stock no puede ser negativo'); return; }

    var data = cargarTodo();
    var productos = data.productos;

    if (!editingProductId) {
        var existe = productos.some(function(p) { 
            return p.nombre.trim().toLowerCase() === nombre.toLowerCase(); 
        });
        if (existe) { showToast('Ya existe un producto con ese nombre'); return; }
    }

    if (editingProductId) {
        var p = null, idx = -1;
        for (var i = 0; i < productos.length; i++) { if (productos[i].id === editingProductId) { p = productos[i]; idx = i; break; } }
        if (p) {
            var diffStock = stock - p.stock;
            if (diffStock !== 0) {
                data.movimientos.unshift({id: generateId(), tipo: diffStock > 0 ? 'Entrada' : 'Ajuste', producto: p.nombre, cantidad: diffStock, fecha: now()});
                if (data.movimientos.length > 200) data.movimientos = data.movimientos.slice(0, 200);
            }
            p.nombre = nombre; p.marca = document.getElementById('prod-marca').value.trim();
            p.precio = precio; p.stock = stock; p.categoria = document.getElementById('prod-cat').value;
            if (fotoProductoBase64) p.foto = fotoProductoBase64;
            else if (fotoProductoEditando) p.foto = fotoProductoEditando;
            if (fotoProductoBase64) p.foto = fotoProductoBase64;
            else if (fotoProductoEditando) p.foto = fotoProductoEditando;
        }
        showToast('✅ Producto actualizado');
    } else {
        var nuevo = {
            id: generateId(), nombre: nombre, marca: document.getElementById('prod-marca').value.trim(),
            precio: precio, stock: stock, categoria: document.getElementById('prod-cat').value,
            foto: fotoProductoBase64, fecha: now()
        };
        productos.push(nuevo);
        data.movimientos.unshift({id: generateId(), tipo: 'Entrada', producto: nombre, cantidad: stock, fecha: now()});
        if (data.movimientos.length > 200) data.movimientos = data.movimientos.slice(0, 200);
        showToast('✅ Producto agregado');
    }

    if (guardarTodo(data)) {
        closeModal('modal-producto');
        renderProductos(); renderInventario(); renderVenta(); renderCatalogo();
    } else { showToast('❌ Error al guardar producto'); }
}

function eliminarProducto(id) {
    var data = cargarTodo();
    var productos = data.productos;
    var p = null;
    for (var i = 0; i < productos.length; i++) { if (productos[i].id === id) { p = productos[i]; break; } }
    if (!p) return;

    var ventas = data.ventas;
    var ventasConProducto = ventas.filter(function(v) { return v.productos && v.productos.some(function(prod) { return prod.id === id; }); });
    if (ventasConProducto.length > 0) {
        showToast('❌ Tiene ' + ventasConProducto.length + ' ventas. No se puede eliminar.');
        return;
    }

    if (!confirm('¿Eliminar "' + escapeHtml(p.nombre) + '"?')) return;
    data.movimientos.unshift({id: generateId(), tipo: 'Eliminacion', producto: p.nombre, cantidad: -p.stock, fecha: now()});
    if (data.movimientos.length > 200) data.movimientos = data.movimientos.slice(0, 200);
    data.productos = productos.filter(function(prod) { return prod.id !== id; });

    if (guardarTodo(data)) {
        showToast('✅ Producto eliminado');
        renderProductos(); renderInventario(); renderVenta(); renderCatalogo();
    } else { showToast('❌ Error al eliminar'); }
}

function renderInventario() {
    var productos = getProductos();
    var container = document.getElementById('inv-lista');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="inv-foto">' : 
            '<div class="inv-foto-placeholder">🌸</div>';
        return '<div class="inv-item">' +
            '<div class="inv-left">' + fotoHtml + '</div>' +
            '<div class="inv-info"><b>' + escapeHtml(p.nombre) + '</b> Stock: ' + p.stock + '</div>' +
            '<div class="inv-stock-bar"><div class="inv-stock-fill" style="width:' + Math.min(p.stock * 10, 100) + '%">' + p.stock + ' uds</div></div></div>';
    }).join('');
}

function filtrarInventario() {
    var input = document.getElementById('inv-buscar');
    if (!input) return;
    var query = input.value.toLowerCase().trim();
    var productos = getProductos().filter(function(p) { return p.nombre.toLowerCase().indexOf(query) !== -1; });
    var container = document.getElementById('inv-lista');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="inv-foto">' : 
            '<div class="inv-foto-placeholder">🌸</div>';
        return '<div class="inv-item">' +
            '<div class="inv-left">' + fotoHtml + '</div>' +
            '<div class="inv-info"><b>' + escapeHtml(p.nombre) + '</b> Stock: ' + p.stock + '</div>' +
            '<div class="inv-stock-bar"><div class="inv-stock-fill" style="width:' + Math.min(p.stock * 10, 100) + '%">' + p.stock + ' uds</div></div></div>';
    }).join('');
}

// FIX #12: switchInvTab usa data-tab en vez de indice
function switchInvTab(tab) {
    var stockContent = document.getElementById('inv-stock-content');
    var movContent = document.getElementById('inv-mov-content');
    if (stockContent) stockContent.style.display = tab === 'stock' ? 'block' : 'none';
    if (movContent) movContent.style.display = tab === 'mov' ? 'block' : 'none';
    var tabs = document.querySelectorAll('#mod-inventario .tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
        if (tabs[i].getAttribute('data-tab') === tab) tabs[i].classList.add('active');
    }
    if (tab === 'mov') renderMovimientos();
}

function renderMovimientos() {
    var movs = getMovimientos();
    var container = document.getElementById('mov-lista');
    if (!container) return;
    if (movs.length === 0) { container.innerHTML = '<div class="empty">No hay movimientos</div>'; return; }
    container.innerHTML = movs.slice(0, 50).map(function(m) {
        return '<div class="mov-item">' +
            '<div class="mov-info"><b>' + escapeHtml(m.tipo) + '</b> ' + escapeHtml(m.producto) + ' | ' + formatDateTime(m.fecha) + '</div>' +
            '<div class="mov-cantidad ' + (m.cantidad > 0 ? 'positive' : 'negative') + '">' + (m.cantidad > 0 ? '+' : '') + m.cantidad + '</div></div>';
    }).join('');
}

// ============================================================
// VENTAS - FIX #7: getClientes fuera del map
// ============================================================
function renderVentas() {
    var ventas = getVentas();
    var clientes = getClientes(); // FIX #7: Fuera del map
    var container = document.getElementById('ventas-lista');
    if (!container) return;
    if (ventas.length === 0) { container.innerHTML = '<div class="empty">No hay ventas</div>'; return; }
    container.innerHTML = ventas.slice(0, 50).map(function(v) {
        var metodoLabel = {efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', credito: 'Fiado'}[v.metodo] || escapeHtml(v.metodo);
        var clienteInfo = '';
        if (v.metodo === 'credito' && v.clienteId) {
            var cli = null;
            for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === v.clienteId) { cli = clientes[i]; break; } }
            if (cli) clienteInfo = ' | ' + escapeHtml(cli.nombre);
        }
        return '<div class="venta-item" data-action="ver-venta" data-id="' + escapeHtml(v.id) + '">' +
            '<div class="venta-info"><b>' + (v.productos ? v.productos.length + ' productos' : 'Venta') + '</b> ' + formatDateTime(v.fecha) + ' | ' + metodoLabel + (v.numCuotas > 1 ? ' | ' + v.numCuotas + ' cuotas' : '') + clienteInfo + '</div>' +
            '<div class="venta-total">' + formatMoney(v.total) + '</div></div>';
    }).join('');
}

function verDetalleVenta(id) {
    var data = cargarTodo();
    var ventas = data.ventas;
    var v = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].id === id) { v = ventas[i]; break; } }
    if (!v) return;
    var clienteNombre = '';
    if (v.clienteId) {
        var clientes = data.clientes;
        for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === v.clienteId) { clienteNombre = clientes[i].nombre; break; } }
    }
    // FIX #10: Escapar TODOS los campos dinamicos
    var html = '<h3>Venta ' + formatDateTime(v.fecha) + '</h3>' +
        '<p><b>Metodo:</b> ' + escapeHtml(v.metodo || 'Efectivo') + '</p>' +
        '<p><b>Total:</b> ' + formatMoney(v.total) + '</p>' +
        (v.numCuotas > 1 ? '<p><b>Cuotas:</b> ' + escapeHtml(String(v.numCuotas)) + '</p>' : '') +
        (clienteNombre ? '<p><b>Cliente:</b> ' + escapeHtml(clienteNombre) + '</p>' : '') +
        '<h4>Productos:</h4>' +
        (v.productos ? v.productos.map(function(p) {
            return '<p><b>' + escapeHtml(p.nombre) + '</b><br>' + escapeHtml(String(p.qty)) + ' x ' + formatMoney(p.precio) + '</p>';
        }).join('') : '');
    var detalleContent = document.getElementById('detalle-content');
    if (detalleContent) { detalleContent.innerHTML = html; showModal('modal-detalle'); }
}

// ============================================================
// CLIENTES - FIX #8: Pre-calcular deudas fuera del map
// ============================================================
function renderClientes() {
    var clientes = getClientes();
    var deudas = getDeudas();
    // FIX #8: Pre-calcular deuda total por cliente
    var deudaPorCliente = {};
    for (var i = 0; i < deudas.length; i++) {
        if (deudas[i].estado === 'activa') {
            deudaPorCliente[deudas[i].clienteId] = (deudaPorCliente[deudas[i].clienteId] || 0) + (deudas[i].saldoPendiente || 0);
        }
    }
    var container = document.getElementById('clientes-lista');
    if (!container) return;
    if (clientes.length === 0) { container.innerHTML = '<div class="empty">No hay clientes</div>'; return; }
    container.innerHTML = clientes.map(function(c) {
        var totalDeuda = deudaPorCliente[c.id] || 0;
        var limite = c.limiteCredito || 0;
        var limiteHtml = limite > 0 ? '<br>💰 Limite: ' + formatMoney(limite) + ' · 🟢 Disp: ' + formatMoney(Math.max(0, limite - totalDeuda)) : '';
        var deudaHtml = totalDeuda > 0 ? '<br>🔴 Deuda: ' + formatMoney(totalDeuda) : '';
        return '<div class="cliente-item" data-action="ver-cliente" data-id="' + escapeHtml(c.id) + '">' +
            '<div class="cliente-info"><b>' + escapeHtml(c.nombre) + '</b><br>' + escapeHtml(c.telefono || 'Sin telefono') + deudaHtml + limiteHtml + '</div>' +
            '<div class="cliente-arrow">›</div></div>';
    }).join('');
}

// FIX #17: Sanitizacion con trim()
function guardarCliente() {
    var nombreInput = document.getElementById('cli-nombre');
    if (!nombreInput) return;
    var nombre = nombreInput.value.trim();
    if (!nombre) { showToast('Nombre obligatorio'); return; }

    var data = cargarTodo();
    var clientes = data.clientes;
    var existe = clientes.some(function(c) { return c.nombre.trim().toLowerCase() === nombre.toLowerCase(); });
    if (existe) { showToast('Ya existe un cliente con ese nombre'); return; }

    var telefonoInput = document.getElementById('cli-telefono');
    var limiteInput = document.getElementById('cli-limite');
    var limite = limiteInput ? parseInt(limiteInput.value) || 0 : 0;
    var cliente = {id: generateId(), nombre: nombre, telefono: telefonoInput ? telefonoInput.value.trim() : '', limiteCredito: limite, fecha: now()};
    clientes.push(cliente);

    if (guardarTodo(data)) {
        nombreInput.value = ''; if (telefonoInput) telefonoInput.value = '';
        closeModal('modal-cliente'); showToast('✅ Cliente guardado'); renderClientes();
    } else { showToast('❌ Error al guardar cliente'); }
}

function verDeudasCliente(clienteId) {
    renderFichaCliente(clienteId);
}

function renderFichaCliente(clienteId) {
    var data = cargarTodo();
    var cliente = null;
    for (var i = 0; i < data.clientes.length; i++) {
        if (data.clientes[i].id === clienteId) { cliente = data.clientes[i]; break; }
    }
    if (!cliente) return;
    var deudasCliente = data.deudas.filter(function(d) { return d.clienteId === clienteId; });
    var deudasActivas = deudasCliente.filter(function(d) { return d.estado === 'activa'; });
    var totalAdeudado = deudasActivas.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var totalPagadoHist = deudasCliente.reduce(function(s, d) { return s + (d.totalPagado || 0); }, 0);
    var limiteCredito = cliente.limiteCredito || 0;
    var disponible = Math.max(0, limiteCredito - totalAdeudado);
    var usadoPct = limiteCredito > 0 ? Math.round((totalAdeudado / limiteCredito) * 100) : 0;
    var html = '<div class="ficha-cliente">' +
        '<div class="ficha-header">' +
        '<div class="ficha-avatar">👤</div>' +
        '<div class="ficha-info">' +
        '<h2>' + escapeHtml(cliente.nombre) + '</h2>' +
        '<p>📱 ' + escapeHtml(cliente.telefono || 'Sin telefono') + '</p>' +
        '<p>📅 Cliente desde: ' + formatDate(cliente.fecha) + '</p>' +
        '</div></div>';
    if (limiteCredito > 0) {
        var barColor = usadoPct > 90 ? 'var(--rojo)' : usadoPct > 70 ? 'var(--amarillo)' : 'var(--turquesa)';
        html += '<div class="ficha-limite">' +
            '<div class="ficha-limite-header">' +
            '<span>💰 Limite: ' + formatMoney(limiteCredito) + '</span>' +
            '<span class="' + (usadoPct > 90 ? 'warning' : '') + '">Usado: ' + usadoPct + '%</span>' +
            '</div>' +
            '<div class="ficha-limite-bar"><div class="ficha-limite-fill" style="width:' + usadoPct + '%;background:' + barColor + '"></div></div>' +
            '<div class="ficha-limite-footer">' +
            '<span>🔴 Adeudado: ' + formatMoney(totalAdeudado) + '</span>' +
            '<span>🟢 Disponible: ' + formatMoney(disponible) + '</span>' +
            '</div></div>';
    } else {
        html += '<div class="ficha-resumen"><div class="ficha-resumen-item">' +
            '<span>🔴 Total Adeudado</span><b>' + formatMoney(totalAdeudado) + '</b></div>' +
            '<div class="ficha-resumen-item"><span>💵 Total Pagado Hist.</span><b>' + formatMoney(totalPagadoHist) + '</b></div></div>';
    }
    if (deudasActivas.length > 0) {
        html += '<h3>📋 Deudas Activas (' + deudasActivas.length + ')</h3>';
        deudasActivas.sort(function(a, b) {
            return new Date(a.proxVencimiento || '9999-12-31') - new Date(b.proxVencimiento || '9999-12-31');
        });
        html += deudasActivas.map(function(d) {
            var hoy = new Date(); hoy.setHours(0,0,0,0);
            var venc = d.proxVencimiento ? new Date(d.proxVencimiento) : null;
            var vencida = venc && venc <= hoy;
            var diasVenc = venc ? Math.ceil((venc - hoy) / (1000*60*60*24)) : null;
            var badgeVenc = vencida ? '<span class="badge-rojo">VENCIDA</span>' :
                diasVenc !== null && diasVenc <= 3 ? '<span class="badge-amarillo">En ' + diasVenc + ' dias</span>' :
                '<span class="badge-verde">Al dia</span>';
            return '<div class="ficha-deuda ' + (vencida ? 'vencida' : '') + '" data-action="ver-deuda-ficha" data-id="' + escapeHtml(d.id) + '">' +
                '<div class="ficha-deuda-header">' +
                '<b>Fiado ' + escapeHtml(d.id.slice(-4)) + '</b>' +
                '<span>' + formatMoney(d.total) + '</span></div>' +
                '<div class="ficha-deuda-body">' +
                '<span>' + (d.cuotasPagadas || 0) + '/' + d.numCuotasTotal + ' cuotas · ' + formatMoney(d.saldoPendiente) + ' pendiente</span>' +
                badgeVenc + '</div>' +
                '<div class="ficha-deuda-footer">Prox venc: ' + formatDate(d.proxVencimiento) + '</div></div>';
        }).join('');
    } else {
        html += '<div class="empty">✅ Sin deudas activas</div>';
    }
    html += '<div class="ficha-actions">' +
        '<button class="btn" onclick="pagarTodoCliente('' + escapeHtml(clienteId) + '')">💵 Pagar Todo (' + formatMoney(totalAdeudado) + ')</button>' +
        '<button class="btn btn-secondary" onclick="showModalEstadoCuenta('' + escapeHtml(clienteId) + '')">📋 Estado de Cuenta</button>' +
        '<button class="btn btn-secondary" onclick="showModalRefinanciar('' + escapeHtml(clienteId) + '')">🔄 Refinanciar</button>' +
        '</div>';
    var todosPagos = [];
    deudasCliente.forEach(function(d) {
        if (d.pagos) {
            d.pagos.forEach(function(p) {
                todosPagos.push({ fecha: p.fecha, monto: p.monto, metodo: p.metodo, cuotaNum: p.cuotaNum });
            });
        }
    });
    todosPagos.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    if (todosPagos.length > 0) {
        html += '<h3>🕐 Historial de Pagos Recientes</h3>';
        html += todosPagos.slice(0, 10).map(function(p) {
            return '<div class="ficha-pago">' +
                '<span>' + formatDateTime(p.fecha) + '</span>' +
                '<b>' + formatMoney(p.monto) + '</b>' +
                '<span>' + escapeHtml(p.metodo || 'efectivo') + ' · Cuota ' + (p.cuotaNum || '?') + '</span></div>';
        }).join('');
    }
    html += '</div>';
    var detalleContent = document.getElementById('detalle-content');
    if (detalleContent) { detalleContent.innerHTML = html; showModal('modal-detalle'); }
}

function pagarTodoCliente(clienteId) {
    var data = cargarTodo();
    var deudasActivas = data.deudas.filter(function(d) { return d.clienteId === clienteId && d.estado === 'activa'; });
    if (deudasActivas.length === 0) { showToast('Sin deudas activas'); return; }
    deudasActivas.sort(function(a, b) {
        return new Date(a.proxVencimiento || '9999-12-31') - new Date(b.proxVencimiento || '9999-12-31');
    });
    var totalAdeudado = deudasActivas.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var html = '<h3>💵 Pagar Deudas de Cliente</h3>' +
        '<p><strong>Total adeudado:</strong> ' + formatMoney(totalAdeudado) + '</p>' +
        '<p style="color:var(--gris);font-size:13px;">Se aplicara primero a la deuda mas antigua (FIFO)</p>' +
        '<div class="ficha-deudas-lista">' +
        deudasActivas.map(function(d, idx) {
            return '<div class="ficha-deuda-mini">' +
                '<b>#' + (idx + 1) + ' · Fiado ' + escapeHtml(d.id.slice(-4)) + '</b>' +
                '<span>' + formatMoney(d.saldoPendiente) + ' · Venc: ' + formatDate(d.proxVencimiento) + '</span>' +
                '</div>';
        }).join('') +
        '</div>' +
        '<label style="font-size:13px;color:var(--gris);margin-top:16px;display:block;">Monto a pagar</label>' +
        '<input type="number" id="pago-total-monto" placeholder="Monto a pagar" value="' + totalAdeudado + '">' +
        '<p style="color:var(--turquesa);font-size:13px;">Sugerido: ' + formatMoney(totalAdeudado) + ' (pagar todo)</p>' +
        '<select id="pago-total-metodo">' +
        '<option value="efectivo">Efectivo</option>' +
        '<option value="transferencia">Transferencia</option>' +
        '<option value="tarjeta">Tarjeta</option>' +
        '</select>' +
        '<button class="btn" onclick="confirmarPagoTotal('' + escapeHtml(clienteId) + '')">Confirmar Pago</button>';
    var detalleContent = document.getElementById('detalle-content');
    if (detalleContent) { detalleContent.innerHTML = html; showModal('modal-detalle'); }
}

function confirmarPagoTotal(clienteId) {
    var montoInput = document.getElementById('pago-total-monto');
    var metodoInput = document.getElementById('pago-total-metodo');
    if (!montoInput) return;
    var montoTotal = parseInt(montoInput.value) || 0;
    var metodo = metodoInput ? metodoInput.value : 'efectivo';
    if (montoTotal <= 0) { showToast('Ingresa un monto valido'); return; }
    var data = cargarTodo();
    var deudas = data.deudas;
    var movimientos = data.movimientos;
    var deudasActivas = deudas.filter(function(d) { return d.clienteId === clienteId && d.estado === 'activa'; });
    deudasActivas.sort(function(a, b) {
        return new Date(a.proxVencimiento || '9999-12-31') - new Date(b.proxVencimiento || '9999-12-31');
    });
    var montoRestante = montoTotal;
    var deudasSaldadas = 0;
    for (var i = 0; i < deudasActivas.length && montoRestante > 0; i++) {
        var d = deudasActivas[i];
        var idx = -1;
        for (var j = 0; j < deudas.length; j++) { if (deudas[j].id === d.id) { idx = j; break; } }
        if (idx === -1) continue;
        var montoAplicar = Math.min(montoRestante, d.saldoPendiente);
        d.saldoPendiente -= montoAplicar;
        d.totalPagado = (d.totalPagado || 0) + montoAplicar;
        montoRestante -= montoAplicar;
        var cuotasCubiertas = 0;
        var montoAcumulado = 0;
        for (var k = 0; k < d.numCuotasTotal; k++) {
            var valorCuotaActual = (k === d.numCuotasTotal - 1 && d.ultimaCuotaValor) ? d.ultimaCuotaValor : d.valorCuota;
            montoAcumulado += valorCuotaActual;
            if (d.totalPagado >= montoAcumulado) cuotasCubiertas = k + 1;
        }
        d.cuotasPagadas = cuotasCubiertas;
        if (d.vencimientos && d.vencimientos.length > d.cuotasPagadas) {
            d.proxVencimiento = d.vencimientos[d.cuotasPagadas];
        } else { d.proxVencimiento = null; }
        if (!d.pagos) d.pagos = [];
        d.pagos.push({monto: montoAplicar, fecha: now(), metodo: metodo, cuotaNum: d.cuotasPagadas, tipo: 'pago_total'});
        movimientos.unshift({id: generateId(), tipo: 'Cobranza', producto: d.clienteNombre, cantidad: montoAplicar, fecha: now()});
        if (d.saldoPendiente <= 0 || d.cuotasPagadas >= d.numCuotasTotal) {
            d.estado = 'pagada'; d.saldoPendiente = 0; d.proxVencimiento = null; d.cuotasPagadas = d.numCuotasTotal;
            deudasSaldadas++;
        }
        deudas[idx] = d;
    }
    if (movimientos.length > 200) movimientos = movimientos.slice(0, 200);
    if (guardarTodo(data)) {
        closeModal('modal-detalle');
        var msg = '✅ Pago registrado: ' + formatMoney(montoTotal - montoRestante);
        if (deudasSaldadas > 0) msg += ' · ' + deudasSaldadas + ' deuda(s) saldada(s)';
        if (montoRestante > 0) msg += ' · Sobrante: ' + formatMoney(montoRestante) + ' (no aplicado)';
        showToast(msg);
        renderDeudas(); renderHistorialDeudas(); updateDashboard();
    } else { showToast('❌ Error al registrar pago'); }
}

function showModalEstadoCuenta(clienteId) {
    var data = cargarTodo();
    var cliente = null;
    for (var i = 0; i < data.clientes.length; i++) {
        if (data.clientes[i].id === clienteId) { cliente = data.clientes[i]; break; }
    }
    if (!cliente) return;
    var deudasCliente = data.deudas.filter(function(d) { return d.clienteId === clienteId; });
    var deudasActivas = deudasCliente.filter(function(d) { return d.estado === 'activa'; });
    var deudasPagadas = deudasCliente.filter(function(d) { return d.estado !== 'activa'; });
    var totalAdeudado = deudasActivas.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var totalPagado = deudasCliente.reduce(function(s, d) { return s + (d.totalPagado || 0); }, 0);
    var totalOriginal = deudasCliente.reduce(function(s, d) { return s + (d.total || 0); }, 0);
    var html = '<div class="estado-cuenta">' +
        '<div class="estado-header">' +
        '<h2>📋 Estado de Cuenta</h2>' +
        '<p><b>' + escapeHtml(cliente.nombre) + '</b></p>' +
        '<p>' + escapeHtml(cliente.telefono || 'Sin telefono') + '</p>' +
        '<p style="color:var(--gris);font-size:13px;">Generado: ' + formatDateTime(now()) + '</p>' +
        '</div>' +
        '<div class="estado-resumen">' +
        '<div class="estado-resumen-item"><span>Total Comprado (Fiado)</span><b>' + formatMoney(totalOriginal) + '</b></div>' +
        '<div class="estado-resumen-item verde"><span>Total Pagado</span><b>' + formatMoney(totalPagado) + '</b></div>' +
        '<div class="estado-resumen-item rojo"><span>Saldo Pendiente</span><b>' + formatMoney(totalAdeudado) + '</b></div>' +
        '</div>';
    if (deudasActivas.length > 0) {
        html += '<h3>Deudas Activas</h3><table class="estado-table">' +
            '<tr><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Cuotas</th><th>Prox Venc</th></tr>' +
            deudasActivas.map(function(d) {
                return '<tr>' +
                    '<td>' + formatDate(d.fecha) + '</td>' +
                    '<td>' + formatMoney(d.total) + '</td>' +
                    '<td>' + formatMoney(d.totalPagado || 0) + '</td>' +
                    '<td><b style="color:var(--rojo)">' + formatMoney(d.saldoPendiente) + '</b></td>' +
                    '<td>' + (d.cuotasPagadas || 0) + '/' + d.numCuotasTotal + '</td>' +
                    '<td>' + formatDate(d.proxVencimiento) + '</td>' +
                    '</tr>';
            }).join('') + '</table>';
    }
    if (deudasPagadas.length > 0) {
        html += '<h3>Deudas Pagadas</h3><table class="estado-table">' +
            '<tr><th>Fecha</th><th>Total</th><th>Pagado</th><th>Estado</th></tr>' +
            deudasPagadas.slice(0, 10).map(function(d) {
                return '<tr>' +
                    '<td>' + formatDate(d.fecha) + '</td>' +
                    '<td>' + formatMoney(d.total) + '</td>' +
                    '<td>' + formatMoney(d.totalPagado || 0) + '</td>' +
                    '<td><span style="color:var(--verde)">✅ Pagada</span></td>' +
                    '</tr>';
            }).join('') + '</table>';
    }
    var todosPagos = [];
    deudasCliente.forEach(function(d) {
        if (d.pagos) {
            d.pagos.forEach(function(p) {
                todosPagos.push({ fecha: p.fecha, monto: p.monto, metodo: p.metodo });
            });
        }
    });
    todosPagos.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    if (todosPagos.length > 0) {
        html += '<h3>Historial de Pagos</h3><table class="estado-table">' +
            '<tr><th>Fecha</th><th>Monto</th><th>Metodo</th></tr>' +
            todosPagos.slice(0, 15).map(function(p) {
                return '<tr>' +
                    '<td>' + formatDateTime(p.fecha) + '</td>' +
                    '<td><b style="color:var(--verde)">' + formatMoney(p.monto) + '</b></td>' +
                    '<td>' + escapeHtml(p.metodo || 'efectivo') + '</td>' +
                    '</tr>';
            }).join('') + '</table>';
    }
    html += '<div class="estado-footer">' +
        '<p style="font-size:12px;color:var(--gris);">Dulces Aromas - Sistema de Cuentas por Cobrar</p>' +
        '</div></div>';
    var detalleContent = document.getElementById('detalle-content');
    if (detalleContent) { detalleContent.innerHTML = html; showModal('modal-detalle'); }
}

function showModalRefinanciar(clienteId) {
    var data = cargarTodo();
    var cliente = null;
    for (var i = 0; i < data.clientes.length; i++) {
        if (data.clientes[i].id === clienteId) { cliente = data.clientes[i]; break; }
    }
    if (!cliente) return;
    var deudasActivas = data.deudas.filter(function(d) { return d.clienteId === clienteId && d.estado === 'activa'; });
    if (deudasActivas.length < 2) { showToast('Se necesitan 2+ deudas para refinanciar'); return; }
    var totalConsolidado = deudasActivas.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var totalOriginal = deudasActivas.reduce(function(s, d) { return s + (d.total || 0); }, 0);
    var totalPagado = deudasActivas.reduce(function(s, d) { return s + (d.totalPagado || 0); }, 0);
    var html = '<h3>🔄 Refinanciar Deudas</h3>' +
        '<p><b>Cliente:</b> ' + escapeHtml(cliente.nombre) + '</p>' +
        '<div class="ficha-deudas-lista">' +
        deudasActivas.map(function(d, idx) {
            return '<div class="ficha-deuda-mini">' +
                '<b>#' + (idx + 1) + ' · Fiado ' + escapeHtml(d.id.slice(-4)) + '</b>' +
                '<span>Original: ' + formatMoney(d.total) + ' · Pagado: ' + formatMoney(d.totalPagado || 0) + ' · Pendiente: ' + formatMoney(d.saldoPendiente) + '</span>' +
                '</div>';
        }).join('') +
        '</div>' +
        '<div class="estado-resumen" style="margin:16px 0;">' +
        '<div class="estado-resumen-item"><span>Total Original</span><b>' + formatMoney(totalOriginal) + '</b></div>' +
        '<div class="estado-resumen-item verde"><span>Ya Pagado</span><b>' + formatMoney(totalPagado) + '</b></div>' +
        '<div class="estado-resumen-item rojo"><span>Nuevo Consolidado</span><b>' + formatMoney(totalConsolidado) + '</b></div>' +
        '</div>' +
        '<label style="font-size:13px;color:var(--gris);">Numero de cuotas (1-12)</label>' +
        '<input type="number" id="refi-cuotas" value="3" min="1" max="12">' +
        '<p id="refi-preview" style="color:var(--turquesa);font-size:14px;font-weight:600;"></p>' +
        '<button class="btn" onclick="confirmarRefinanciar('' + escapeHtml(clienteId) + '')">Confirmar Refinanciacion</button>';
    var detalleContent = document.getElementById('detalle-content');
    if (detalleContent) {
        detalleContent.innerHTML = html;
        showModal('modal-detalle');
        actualizarRefiPreview(totalConsolidado);
        document.getElementById('refi-cuotas').addEventListener('change', function() { actualizarRefiPreview(totalConsolidado); });
        document.getElementById('refi-cuotas').addEventListener('keyup', function() { actualizarRefiPreview(totalConsolidado); });
    }
}

function actualizarRefiPreview(total) {
    var numCuotas = parseInt(document.getElementById('refi-cuotas').value) || 1;
    if (numCuotas < 1) numCuotas = 1; if (numCuotas > 12) numCuotas = 12;
    document.getElementById('refi-cuotas').value = numCuotas;
    var preview = document.getElementById('refi-preview');
    if (!preview) return;
    var valorBase = Math.floor(total / numCuotas);
    var ultima = Math.max(0, total - (valorBase * (numCuotas - 1)));
    if (numCuotas === 1) preview.textContent = '1 pago de ' + formatMoney(total);
    else preview.textContent = (numCuotas - 1) + ' cuotas de ' + formatMoney(valorBase) + ' + ultima de ' + formatMoney(ultima);
}

function confirmarRefinanciar(clienteId) {
    var numCuotas = parseInt(document.getElementById('refi-cuotas').value) || 1;
    if (numCuotas < 1 || numCuotas > 12) { showToast('Cuotas entre 1 y 12'); return; }
    var data = cargarTodo();
    var cliente = null;
    for (var i = 0; i < data.clientes.length; i++) {
        if (data.clientes[i].id === clienteId) { cliente = data.clientes[i]; break; }
    }
    if (!cliente) return;
    var deudas = data.deudas;
    var deudasActivas = deudas.filter(function(d) { return d.clienteId === clienteId && d.estado === 'activa'; });
    if (deudasActivas.length < 2) { showToast('Se necesitan 2+ deudas activas'); return; }
    var totalConsolidado = deudasActivas.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var totalOriginal = deudasActivas.reduce(function(s, d) { return s + (d.total || 0); }, 0);
    var totalPagado = deudasActivas.reduce(function(s, d) { return s + (d.totalPagado || 0); }, 0);
    if (!confirm('⚠️ Se marcaran ' + deudasActivas.length + ' deudas como refinanciadas y se creara una nueva.\n\nTotal consolidado: ' + formatMoney(totalConsolidado) + '\nEn ' + numCuotas + ' cuota(s)\n\n¿Confirmar?')) { return; }
    for (var i = 0; i < deudasActivas.length; i++) {
        for (var j = 0; j < deudas.length; j++) {
            if (deudas[j].id === deudasActivas[i].id) {
                deudas[j].estado = 'refinanciada';
                deudas[j].saldoPendiente = 0;
                deudas[j].proxVencimiento = null;
                deudas[j].nota = 'Refinanciada en ' + now();
                break;
            }
        }
    }
    var valorCuotaBase = Math.floor(totalConsolidado / numCuotas);
    var ultimaCuota = Math.max(0, totalConsolidado - (valorCuotaBase * (numCuotas - 1)));
    var hoy = new Date();
    var diaCompra = hoy.getDate();
    var vencimientos = [];
    for (var i = 1; i <= numCuotas; i++) {
        var venc = new Date(hoy.getFullYear(), hoy.getMonth() + i, diaCompra);
        if (venc.getDate() !== diaCompra) { venc = new Date(venc.getFullYear(), venc.getMonth(), 0); }
        var yyyy = venc.getFullYear();
        var mm = String(venc.getMonth() + 1).padStart(2, '0');
        var dd = String(venc.getDate()).padStart(2, '0');
        vencimientos.push(yyyy + '-' + mm + '-' + dd + 'T00:00:00.000Z');
    }
    var nuevaDeuda = {
        id: generateId(), clienteId: clienteId, clienteNombre: cliente.nombre,
        total: totalConsolidado, saldoPendiente: totalConsolidado, numCuotasTotal: numCuotas,
        cuotasPagadas: 0, totalPagado: 0, valorCuota: valorCuotaBase, ultimaCuotaValor: ultimaCuota,
        estado: 'activa', fecha: now(), proxVencimiento: vencimientos[0], vencimientos: vencimientos,
        pagos: [], refinanciadaDe: deudasActivas.map(function(d) { return d.id; }),
        totalOriginal: totalOriginal, totalPagadoPrevio: totalPagado
    };
    deudas.unshift(nuevaDeuda);
    data.movimientos.unshift({id: generateId(), tipo: 'Refinanciacion', producto: cliente.nombre, cantidad: totalConsolidado, fecha: now()});
    if (data.movimientos.length > 200) data.movimientos = data.movimientos.slice(0, 200);
    if (guardarTodo(data)) {
        closeModal('modal-detalle');
        showToast('✅ Refinanciacion completada: ' + formatMoney(totalConsolidado) + ' en ' + numCuotas + ' cuota(s)');
        renderDeudas(); renderHistorialDeudas(); updateDashboard();
    } else { showToast('❌ Error al refinanciar'); }
}


// ============================================================
// DEUDAS
// ============================================================
function renderDeudas() {
    var deudas = getDeudas().filter(function(d) { return d.estado === 'activa'; });
    var container = document.getElementById('deudas-lista');
    if (!container) return;
    if (deudas.length === 0) { container.innerHTML = '<div class="empty">No hay deudas activas</div>'; return; }
    container.innerHTML = deudas.slice(0, 50).map(function(d) {
        var hoy = new Date(); hoy.setHours(0,0,0,0);
        var venc = d.proxVencimiento ? new Date(d.proxVencimiento) : null;
        var vencida = venc && venc <= hoy;
        return '<div class="deuda-item ' + (vencida ? 'vencida' : '') + '" data-action="ver-deuda" data-id="' + escapeHtml(d.id) + '">' +
            '<div class="deuda-info"><b>' + escapeHtml(d.clienteNombre) + '</b> Total: ' + formatMoney(d.total) + ' | Pendiente: ' + formatMoney(d.saldoPendiente) + ' | Prox venc: ' + formatDate(d.proxVencimiento) + '</div>' +
            '<div class="deuda-cuotas">' + (d.cuotasPagadas || 0) + '/' + d.numCuotasTotal + '</div></div>';
    }).join('');
}

function renderHistorialDeudas() {
    var deudas = getDeudas().filter(function(d) { return d.estado !== 'activa'; });
    var container = document.getElementById('deudas-historial-lista');
    if (!container) return;
    if (deudas.length === 0) { container.innerHTML = '<div class="empty">No hay deudas en historial</div>'; return; }
    container.innerHTML = deudas.slice(0, 50).map(function(d) {
        var estadoLabel = d.estado === 'refinanciada' ? 'Refinanciada' : 'Pagada';
        var estadoClass = d.estado === 'refinanciada' ? 'refinanciada' : 'pagada';
        var estadoColor = d.estado === 'refinanciada' ? 'var(--amarillo)' : 'var(--verde)';
        var bgColor = d.estado === 'refinanciada' ? 'rgba(245,158,11,0.1)' : 'var(--verde-glass)';
        return '<div class="deuda-item ' + estadoClass + '">' +
            '<div class="deuda-info"><b>' + escapeHtml(d.clienteNombre) + '</b> Total: ' + formatMoney(d.total) + ' | Pagado: ' + formatMoney((d.total || 0) - (d.saldoPendiente || 0)) + (d.estado === 'refinanciada' ? ' | Consolidado: ' + formatMoney(d.saldoPendiente) : '') + '</div>' +
            '<div class="deuda-estado" style="background:' + bgColor + ';color:' + estadoColor + ';">' + estadoLabel + '</div></div>';
    }).join('');
}

// FIX #12: switchDeudaTab usa data-tab
function switchDeudaTab(tab) {
    var activasContent = document.getElementById('deudas-activas-content');
    var historialContent = document.getElementById('deudas-historial-content');
    if (activasContent) activasContent.style.display = tab === 'activas' ? 'block' : 'none';
    if (historialContent) historialContent.style.display = tab === 'historial' ? 'block' : 'none';
    var tabs = document.querySelectorAll('#mod-deudas .tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
        if (tabs[i].getAttribute('data-tab') === tab) tabs[i].classList.add('active');
    }
}

function verDetalleDeuda(id) {
    var data = cargarTodo();
    var deudas = data.deudas;
    var d = null;
    for (var i = 0; i < deudas.length; i++) { if (deudas[i].id === id) { d = deudas[i]; break; } }
    if (!d) return;
    editingDeudaId = id;
    var deudaCliente = document.getElementById('deuda-cliente');
    var deudaTotal = document.getElementById('deuda-total');
    var deudaPendiente = document.getElementById('deuda-pendiente');
    var deudaCuotas = document.getElementById('deuda-cuotas');
    var deudaProxVenc = document.getElementById('deuda-prox-venc');
    if (deudaCliente) deudaCliente.textContent = escapeHtml(d.clienteNombre);
    if (deudaTotal) deudaTotal.textContent = formatMoney(d.total);
    if (deudaPendiente) deudaPendiente.textContent = formatMoney(d.saldoPendiente);
    if (deudaCuotas) deudaCuotas.textContent = (d.cuotasPagadas || 0) + '/' + d.numCuotasTotal;
    if (deudaProxVenc) deudaProxVenc.textContent = formatDate(d.proxVencimiento);
    var cuotasRestantes = d.numCuotasTotal - (d.cuotasPagadas || 0);
    var valorSugerido = cuotasRestantes > 0 ? d.valorCuota : d.saldoPendiente;
    if (cuotasRestantes === 1 && d.ultimaCuotaValor) valorSugerido = d.ultimaCuotaValor;
    var deudaPago = document.getElementById('deuda-pago');
    var deudaPagoSugerido = document.getElementById('deuda-pago-sugerido');
    if (deudaPago) deudaPago.value = valorSugerido;
    if (deudaPagoSugerido) deudaPagoSugerido.textContent = 'Sugerido: ' + formatMoney(valorSugerido);
    var metodoSelect = document.getElementById('deuda-metodo-pago');
    if (metodoSelect) {
        metodoSelect.innerHTML = '<option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option>';
    }
    var pagosHtml = '<h4>Historial de Pagos</h4>';
    if (d.pagos && d.pagos.length > 0) {
        pagosHtml += d.pagos.map(function(p) {
            return '<div class="pago-item"><b>Pago ' + escapeHtml(String(p.cuotaNum || '')) + '</b> ' + formatDateTime(p.fecha) + '<br>' + formatMoney(p.monto) + ' (' + escapeHtml(p.metodo || 'efectivo') + ')</div>';
        }).join('');
    } else { pagosHtml += '<p>Sin pagos registrados</p>'; }
    if (d.vencimientos && d.vencimientos.length > 0) {
        pagosHtml += '<h4>Vencimientos</h4>';
        var hoy = new Date(); hoy.setHours(0,0,0,0);
        pagosHtml += d.vencimientos.map(function(v, idx) {
            var venc = new Date(v);
            var pagada = idx < (d.cuotasPagadas || 0);
            var vencida = !pagada && venc <= hoy;
            return '<div class="venc-item ' + (pagada ? 'pagada' : vencida ? 'vencida' : '') + '"><b>Cuota ' + (idx + 1) + '</b><br>' + formatDate(v) + (pagada ? ' (Pagada)' : vencida ? ' (Vencida)' : '') + '</div>';
        }).join('');
    }
    var deudaPagosLista = document.getElementById('deuda-pagos-lista');
    if (deudaPagosLista) deudaPagosLista.innerHTML = pagosHtml;
    showModal('modal-deuda-detalle');
}

function registrarPagoDeuda() {
    var montoInput = document.getElementById('deuda-pago');
    var metodoInput = document.getElementById('deuda-metodo-pago');
    if (!montoInput) return;
    var monto = parseInt(montoInput.value) || 0;
    var metodo = metodoInput ? metodoInput.value : 'efectivo';
    if (monto <= 0) { showToast('Ingresa un monto valido'); return; }

    var data = cargarTodo();
    var deudas = data.deudas;
    var movimientos = data.movimientos;
    var d = null, idx = -1;
    for (var i = 0; i < deudas.length; i++) { if (deudas[i].id === editingDeudaId) { d = deudas[i]; idx = i; break; } }
    if (!d) return;
    if (monto > d.saldoPendiente) { showToast('El pago excede el saldo'); return; }

    d.saldoPendiente -= monto;
    d.totalPagado = (d.totalPagado || 0) + monto;
    var cuotasCubiertas = 0;
    var montoAcumulado = 0;
    for (var i = 0; i < d.numCuotasTotal; i++) {
        var valorCuotaActual = (i === d.numCuotasTotal - 1 && d.ultimaCuotaValor) ? d.ultimaCuotaValor : d.valorCuota;
        montoAcumulado += valorCuotaActual;
        if (d.totalPagado >= montoAcumulado) cuotasCubiertas = i + 1;
    }
    d.cuotasPagadas = cuotasCubiertas;
    if (d.vencimientos && d.vencimientos.length > d.cuotasPagadas) {
        d.proxVencimiento = d.vencimientos[d.cuotasPagadas];
    } else { d.proxVencimiento = null; }
    if (!d.pagos) d.pagos = [];
    d.pagos.push({monto: monto, fecha: now(), metodo: metodo, cuotaNum: d.cuotasPagadas});

    movimientos.unshift({id: generateId(), tipo: 'Cobranza', producto: d.clienteNombre, cantidad: monto, fecha: now()});
    if (movimientos.length > 200) movimientos = movimientos.slice(0, 200);

    var saldada = false;
    if (d.saldoPendiente <= 0 || d.cuotasPagadas >= d.numCuotasTotal) {
        d.estado = 'pagada'; d.saldoPendiente = 0; d.proxVencimiento = null; d.cuotasPagadas = d.numCuotasTotal;
        saldada = true;
    }
    deudas[idx] = d;

    if (guardarTodo(data)) {
        closeModal('modal-deuda-detalle');
        if (saldada) showToast('✅ Deuda saldada completamente');
        else showToast('✅ Pago registrado: ' + formatMoney(monto) + ' | Cuota ' + d.cuotasPagadas + '/' + d.numCuotasTotal);
        renderDeudas(); renderHistorialDeudas(); updateDashboard();
    } else { showToast('❌ Error al registrar pago'); }
}

// ============================================================
// CATALOGO
// ============================================================
function renderCatalogo() {
    var productos = getProductos().filter(function(p) { return p.stock > 0; });
    var container = document.getElementById('catalogo-lista');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = '<div class="empty">No hay productos disponibles</div>'; return; }
    container.innerHTML = productos.map(function(p) {
        var fotoHtml = p.foto ? '<img src="' + escapeHtml(p.foto) + '" class="cat-foto">' : '<div class="cat-foto-placeholder">🌸</div>';
        return '<div class="catalogo-card">' + fotoHtml +
            '<div class="cat-nombre">' + escapeHtml(p.nombre) + '</div>' +
            '<div class="cat-precio">' + formatMoney(p.precio) + '</div>' +
            '<div class="cat-stock">Stock: ' + p.stock + '</div></div>';
    }).join('');
}

// ============================================================
// MODALES
// ============================================================
function showModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
    if (id === 'modal-producto') { editingProductId = null; fotoProductoBase64 = null; fotoProductoEditando = null; fotoProductoBase64 = null; fotoProductoEditando = null; }
    if (id === 'modal-deuda-detalle') { editingDeudaId = null; }
    if (id === 'modal-cliente') { var cn = document.getElementById('cli-nombre'); var ct = document.getElementById('cli-telefono'); var cl = document.getElementById('cli-limite'); if (cn) cn.value = ''; if (ct) ct.value = ''; if (cl) cl.value = ''; }
    if (id === 'modal-credito') { var cc = document.getElementById('credito-cliente'); var cq = document.getElementById('credito-cuotas'); if (cc) cc.value = ''; if (cq) cq.value = '1'; actualizarCuotaPreview(); }
}

function guardarConfig() {
    var configNombre = document.getElementById('config-nombre');
    var config = {nombre: configNombre ? configNombre.value.trim() : ''};
    Store.set('config', config);
    showToast('Configuracion guardada');
}

// ============================================================
// BACKUP - FIX #10: Validacion de schema en importacion
// ============================================================
function exportarExcel() {
    var data = cargarTodo();
    var wb = XLSX.utils.book_new();
    wb.Props = {Title: "Dulces Aromas", Subject: "Backup POS", Author: "Dulces Aromas"};
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.productos), "Productos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.ventas), "Ventas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.clientes), "Clientes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.deudas), "Deudas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.movimientos), "Movimientos");
    XLSX.writeFile(wb, "Dulces-Aromas-Backup.xlsx");
    showToast("✅ Excel exportado");
}

// FIX #10: Validar schema antes de guardar importacion
function validarProducto(p) {
    if (!p || typeof p !== 'object') return false;
    var precioNormalizado = normalizarPrecio(p.precio);
    var stockValido = typeof p.stock === 'number' ? p.stock : parseInt(p.stock) || 0;
    return p.id && p.nombre && precioNormalizado >= 0 && stockValido >= 0;
}
function validarVenta(v) {
    return v && typeof v === 'object' && v.id && v.productos && Array.isArray(v.productos) && typeof v.total === 'number' && v.total >= 0;
}
function validarCliente(c) {
    return c && typeof c === 'object' && c.id && c.nombre;
}
function validarDeuda(d) {
    return d && typeof d === 'object' && d.id && d.clienteId && typeof d.total === 'number' && typeof d.saldoPendiente === 'number';
}

function importarBackup(input) {
    var file = input.files[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) { showToast('❌ Solo archivos .xlsx'); input.value = ''; return; }
    if (!confirm(`⚠️ Esto reemplazara todos los datos actuales. ¿Estas seguro?`)) { input.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var raw = new Uint8Array(e.target.result);
            var workbook = XLSX.read(raw, {type: 'array'});
            var data = {productos: [], ventas: [], clientes: [], deudas: [], movimientos: []};
            if (workbook.SheetNames.indexOf('Productos') >= 0) {
                var prodRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Productos']);
                data.productos = prodRaw.filter(validarProducto);
                if (prodRaw.length !== data.productos.length) showToast('⚠️ Algunos productos invalidos fueron ignorados');
            }
            if (workbook.SheetNames.indexOf('Ventas') >= 0) {
                var ventRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Ventas']);
                data.ventas = ventRaw.filter(validarVenta);
            }
            if (workbook.SheetNames.indexOf('Clientes') >= 0) {
                var cliRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Clientes']);
                data.clientes = cliRaw.filter(validarCliente);
            }
            if (workbook.SheetNames.indexOf('Deudas') >= 0) {
                var deuRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Deudas']);
                data.deudas = deuRaw.filter(validarDeuda);
            }
            if (workbook.SheetNames.indexOf('Movimientos') >= 0) data.movimientos = XLSX.utils.sheet_to_json(workbook.Sheets['Movimientos']);

            // FIX #5: Verificar que no se pierdan todos los datos
            var datosPrevios = cargarTodo();
            var hayDatosPrevios = datosPrevios.productos.length > 0 || datosPrevios.ventas.length > 0;
            var hayDatosNuevos = data.productos.length > 0 || data.ventas.length > 0 || data.clientes.length > 0;

            if (!hayDatosNuevos && hayDatosPrevios) {
                showToast('❌ Archivo sin datos validos. Se mantiene la base actual.');
                return;
            }

            if (data.productos.length === 0 && data.ventas.length === 0 && data.clientes.length === 0) {
                showToast('❌ Archivo vacio o sin datos validos');
                return;
            }

            if (guardarTodo(data)) {
                showToast('✅ Backup cargado. Recargando...');
                setTimeout(function() { location.reload(); }, 1000);
            } else {
                showToast('❌ Error al guardar datos');
            }
        } catch(err) {
            showToast('❌ Error al leer Excel: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
}

// ============================================================
// EVENT DELEGATION
// ============================================================
// FIX #8: Event delegation mejorado - busca data-action en toda la jerarquia
function setupEventDelegation() {
    document.addEventListener('click', function(e) {
        var target = e.target;
        var action = null;
        var id = null;
        var idx = null;

        // Buscar el elemento con data-action más cercano
        while (target && target !== document.body) {
            if (target.getAttribute('data-action')) {
                action = target.getAttribute('data-action');
                id = target.getAttribute('data-id');
                idx = target.getAttribute('data-idx');
                break;
            }
            target = target.parentElement;
        }

        if (!action) return;

        switch(action) {
            case 'add-cart':
                if (id) { e.stopPropagation(); agregarAlCarro(id); }
                return;
            case 'cart-minus':
                if (idx !== null) { e.stopPropagation(); restarDelCarro(parseInt(idx)); }
                return;
            case 'cart-plus':
                if (idx !== null) { e.stopPropagation(); sumarAlCarro(parseInt(idx)); }
                return;
            case 'edit-prod':
                if (id) { e.stopPropagation(); editarProducto(id); }
                return;
            case 'del-prod':
                if (id) { e.stopPropagation(); eliminarProducto(id); }
                return;
            case 'ver-venta':
                if (id) { e.stopPropagation(); verDetalleVenta(id); }
                return;
            case 'ver-cliente':
                if (id) { e.stopPropagation(); verDeudasCliente(id); }
                return;
            case 'ver-deuda':
                if (id) { e.stopPropagation(); verDetalleDeuda(id); }
                return;
            case 'ver-deuda-ficha':
                if (id) { e.stopPropagation(); verDetalleDeuda(id); }
                return;
        }
    });
}

// ============================================================
// INICIO
// ============================================================

var PRODUCTOS_DEMO = [
  {
    "id": "da0186",
    "nombre": "TUBBEES CANDY POP GRANDEUR EDP 50ml.",
    "marca": "",
    "precio": 10000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0187",
    "nombre": "TUBBEES PINK SUGAR GRANDEUR EDP 50ml.",
    "marca": "",
    "precio": 10000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0188",
    "nombre": "TUBBEES TROPICAL ISLAND GRANDEUR EDP 50ml.",
    "marca": "",
    "precio": 10000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0189",
    "nombre": "UNGARO FOR HER KIT 100 ml + 10 ml",
    "marca": "",
    "precio": 25000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0190",
    "nombre": "UNGARO FRUIT D AMOUR PINK 100 ml",
    "marca": "",
    "precio": 30000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0191",
    "nombre": "UNGARO FRUIT D AMOUR TORQUOISE 100 ml",
    "marca": "",
    "precio": 30000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0192",
    "nombre": "VALENTINO DONNA BORN IN ROMA YELLOW EDP 100 ML",
    "marca": "",
    "precio": 100000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0193",
    "nombre": "VALENTINO VALENTINA EDP 80 ML",
    "marca": "",
    "precio": 80000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0194",
    "nombre": "VICTORIA SECRET BODY MIST CHROME PEONY 250ml.",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0195",
    "nombre": "VICTORIA SECRET BODY MIST CRISP ORCHID 250ml.",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0196",
    "nombre": "VICTORIA SECRET BODY MIST FROSTMELT 250ml.",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0197",
    "nombre": "VICTORIA SECRET BODY MIST LOVE SPELL STARLIT 250ml.",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0198",
    "nombre": "VICTORIA SECRET BODY MIST MIRROED POM 250ml.",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0199",
    "nombre": "VICTORIA SECRET BODY MIST PLATINUM BERRIES 250ml.",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0200",
    "nombre": "VICTORIA SECRET BODY MIST POOLSIDE SERVICE 250ml.",
    "marca": "",
    "precio": 20000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0201",
    "nombre": "VICTORIA SECRET EAU SO PARTY 50ml",
    "marca": "",
    "precio": 40000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0202",
    "nombre": "VICTORIA SECRET LOVE ME 50ml",
    "marca": "",
    "precio": 40000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0203",
    "nombre": "VICTORIA SECRET MIST SECRET CHARM 200 ml",
    "marca": "",
    "precio": 14000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0204",
    "nombre": "VICTORIA SECRET NOIR TEASE 250 ml PERFUME",
    "marca": "",
    "precio": 25000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0205",
    "nombre": "VICTORIA SECRET SET PURÉ SEDUCTION 75ml + LIP GLOW",
    "marca": "",
    "precio": 25000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0206",
    "nombre": "VICTORIA SECRET TEASE REBEL 50ml",
    "marca": "",
    "precio": 40000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0207",
    "nombre": "VIKTOR & ROLF MINI SET 4 PIEZAS EDP",
    "marca": "",
    "precio": 45000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0208",
    "nombre": "VIKTOR AND ROLF FLOWERBOMB EDP 100 ML",
    "marca": "",
    "precio": 90000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0209",
    "nombre": "Victoria Secret Crema Corporal Aqua kiss 236 ML",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0210",
    "nombre": "Victoria Secret Crema Corporal Cactus Water 236ML",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0211",
    "nombre": "Victoria Secret Crema Corporal Cool Blooms 236 ML",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0212",
    "nombre": "Victoria Secret Crema Corporal Jasmine Rainfall 236 ML",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0213",
    "nombre": "Victoria Secret Crema Corporal Lush Air 236 ML",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0214",
    "nombre": "Victoria Secret Crema Corporal love spell 236 ML",
    "marca": "",
    "precio": 18000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0215",
    "nombre": "Victoria Secret Crema Corporal puré seduction 236 ML",
    "marca": "",
    "precio": 20000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0216",
    "nombre": "WOMEN SECRET BERRY TEMPTATION 40 ML",
    "marca": "",
    "precio": 10000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0217",
    "nombre": "WOMEN SECRET INTIMATE DAYDREAM SET",
    "marca": "",
    "precio": 30000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0218",
    "nombre": "WOMEN SECRET ROSE SEDUCTION 100 ml",
    "marca": "",
    "precio": 20000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0219",
    "nombre": "Woman Dubai body mist 125ml",
    "marca": "",
    "precio": 12000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0220",
    "nombre": "Woman Sidney body mist 125ml",
    "marca": "",
    "precio": 12000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0221",
    "nombre": "YARA air freshener 300ml",
    "marca": "",
    "precio": 10000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0222",
    "nombre": "YARA air freshener moi 300ml",
    "marca": "",
    "precio": 10000,
    "stock": 1,
    "categoria": "dama",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  },
  {
    "id": "da0224",
    "nombre": "LOL EDT 100 ml",
    "marca": "",
    "precio": 15000,
    "stock": 1,
    "categoria": "niños",
    "foto": null,
    "fecha": "2026-05-10T00:00:00.000Z"
  }
];

function initApp() {
    setupEventDelegation();
    restaurarCarrito();
    actualizarCarroUI();
    var data = cargarTodo();
    if (data.productos.length === 0) {
        fetch('productos.json')
        .then(function(response) { return response.json(); })
        .then(function(productosDemo) {
            if (productosDemo && productosDemo.length > 0) {
                data.productos = productosDemo;
                guardarTodo(data);
                showToast(productosDemo.length + ' productos cargados');
            } else {
                data.productos = PRODUCTOS_DEMO;
                guardarTodo(data);
                showToast(PRODUCTOS_DEMO.length + ' productos precargados');
            }
            updateDashboard();
        })
        .catch(function(err) {
            data.productos = PRODUCTOS_DEMO;
            guardarTodo(data);
            showToast(PRODUCTOS_DEMO.length + ' productos precargados (offline)');
            updateDashboard();
        });
    } else {
        updateDashboard();
    }
}

document.addEventListener('DOMContentLoaded', function() { initApp(); });
