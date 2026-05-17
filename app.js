// ============================================================
// POS DULCES AROMAS - v2026.05.11-corregido
// 15 fixes criticos aplicados - NO MODIFICAR ESTRUCTURA VISUAL
// ============================================================

function formatMoney(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return '$0';
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

// FIX #18: ID unico con counter para evitar colisiones en milisegundos
var idCounter = 0;
function generateId() {
    idCounter = (idCounter + 1) % 10000;
    return Date.now().toString(36) + idCounter.toString(36).padStart(4,'0') + Math.random().toString(36).substr(2, 5);
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
        .replace(/\//g, "&#x2F;");
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
        localStorage.setItem('da_todo', json);
        return true;
    } catch(e) {
        if (e.name === 'QuotaExceededError') showToast('⚠️ Almacenamiento lleno. Exporta backup.');
        else showToast('Error guardando: ' + e.message);
        return false;
    }
}

// FIX #5: Carga atomica + limpieza de keys antiguas migradas
function cargarTodo() {
    try {
        var todo = localStorage.getItem('da_todo');
        if (todo) {
            var parsed = JSON.parse(todo);
            return {
                productos: parsed.productos || [],
                ventas: parsed.ventas || [],
                clientes: parsed.clientes || [],
                deudas: parsed.deudas || [],
                movimientos: parsed.movimientos || []
            };
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
        return data;
    } catch(e) {
        console.error('Error cargando datos:', e);
        return {productos: [], ventas: [], clientes: [], deudas: [], movimientos: []};
    }
}

function getProductos() { return cargarTodo().productos; }
function getVentas() { return cargarTodo().ventas; }
function getClientes() { return cargarTodo().clientes; }
function getDeudas() { return cargarTodo().deudas; }
function getMovimientos() { return cargarTodo().movimientos; }

var currentModule = 'dashboard';
var cart = [];
var editingProductId = null;
var editingDeudaId = null;
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

function guardarCarrito() {
    try { sessionStorage.setItem('da_cart', JSON.stringify(cart)); } catch(e) {}
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
        vencimientos.push(venc.toISOString());
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

// FIX #2: Race condition en subir foto - flag de bloqueo + limpieza
var fotoUploadLock = false;
function subirFotoProducto(id) {
    if (fotoUploadLock) { showToast('Espera... otra carga en progreso'); return; }
    fotoUploadLock = true;

    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';

    var limpiar = function() {
        fotoUploadLock = false;
        if (input.parentNode) document.body.removeChild(input);
    };

    // Limpieza si cancela el dialogo (timeout de seguridad)
    var timeoutCancel = setTimeout(function() {
        if (fotoUploadLock) { limpiar(); }
    }, 120000); // 2 minutos maximo

    input.addEventListener('change', function(e) {
        clearTimeout(timeoutCancel);
        var targetId = id;
        var file = e.target.files[0];
        if (!file) { limpiar(); return; }
        if (file.size > 5 * 1024 * 1024) { showToast('Imagen muy grande. Max 5MB'); limpiar(); return; }
        var reader = new FileReader();
        reader.onload = function(ev) {
            showToast('Procesando imagen...');
            redimensionarImagen(ev.target.result, 800, 800, function(resized) {
                if (!resized) { showToast('Error al procesar'); limpiar(); return; }
                var data = cargarTodo();
                var productos = data.productos;
                var encontrado = false;
                for (var i = 0; i < productos.length; i++) {
                    if (productos[i].id === targetId) { productos[i].foto = resized; encontrado = true; break; }
                }
                if (encontrado) {
                    if (guardarTodo(data)) {
                        showToast('✅ Foto agregada');
                        renderProductos(); renderInventario(); renderVenta(); renderCatalogo();
                    } else { showToast('❌ Error al guardar foto'); }
                } else { showToast('❌ Producto no encontrado'); }
                limpiar();
            });
        };
        reader.onerror = function() { showToast('Error al leer imagen'); limpiar(); };
        reader.readAsDataURL(file);
    });

    document.body.appendChild(input);
    input.click();
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
    editingProductId = null; fotoProductoBase64 = null; fotoProductoEditando = null;
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-marca').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-cat').value = 'caballero';
    document.getElementById('prod-foto-preview').style.display = 'none';
    document.getElementById('prod-foto-img').src = '';
    document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
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
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-marca').value = p.marca || '';
    document.getElementById('prod-precio').value = p.precio;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-cat').value = p.categoria || 'caballero';
    if (p.foto) {
        document.getElementById('prod-foto-img').src = p.foto;
        document.getElementById('prod-foto-preview').style.display = 'block';
    } else {
        document.getElementById('prod-foto-preview').style.display = 'none';
    }
    document.getElementById('modal-producto-title').textContent = 'Editar Producto';
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
        var metodoLabel = {efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', credito: 'Fiado'}[v.metodo] || v.metodo;
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
    var html = '<h3>Venta ' + formatDateTime(v.fecha) + '</h3>' +
        '<p><b>Metodo:</b> ' + escapeHtml(v.metodo || 'Efectivo') + '</p>' +
        '<p><b>Total:</b> ' + formatMoney(v.total) + '</p>' +
        (v.numCuotas > 1 ? '<p><b>Cuotas:</b> ' + v.numCuotas + '</p>' : '') +
        (clienteNombre ? '<p><b>Cliente:</b> ' + escapeHtml(clienteNombre) + '</p>' : '') +
        '<h4>Productos:</h4>' +
        (v.productos ? v.productos.map(function(p) {
            return '<p><b>' + escapeHtml(p.nombre) + '</b><br>' + p.qty + ' x ' + formatMoney(p.precio) + '</p>';
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
        return '<div class="cliente-item" data-action="ver-cliente" data-id="' + escapeHtml(c.id) + '">' +
            '<div class="cliente-info"><b>' + escapeHtml(c.nombre) + '</b><br>' + escapeHtml(c.telefono || 'Sin telefono') + (totalDeuda > 0 ? ' | Deuda: ' + formatMoney(totalDeuda) : '') + '</div>' +
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
    var cliente = {id: generateId(), nombre: nombre, telefono: telefonoInput ? telefonoInput.value.trim() : '', fecha: now()};
    clientes.push(cliente);

    if (guardarTodo(data)) {
        nombreInput.value = ''; if (telefonoInput) telefonoInput.value = '';
        closeModal('modal-cliente'); showToast('✅ Cliente guardado'); renderClientes();
    } else { showToast('❌ Error al guardar cliente'); }
}

function verDeudasCliente(clienteId) {
    var data = cargarTodo();
    var deudas = data.deudas.filter(function(d) { return d.clienteId === clienteId && d.estado === 'activa'; });
    var cliente = null;
    var clientes = data.clientes;
    for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { cliente = clientes[i]; break; } }

    var totalAdeudado = deudas.reduce(function(s, d) { return s + (d.saldoPendiente || 0); }, 0);
    var totalCuotas = deudas.reduce(function(s, d) { return s + d.numCuotasTotal; }, 0);
    var cuotasPagadas = deudas.reduce(function(s, d) { return s + (d.cuotasPagadas || 0); }, 0);

    var html = '<h3>Deudas de ' + escapeHtml(cliente ? cliente.nombre : 'Cliente') + '</h3>' +
        '<div style="background:linear-gradient(135deg, var(--turquesa-light) 0%, var(--azul-verdoso-glass) 100%);padding:16px;border-radius:var(--radio-sm);margin-bottom:16px;border:1px solid var(--gris-borde);">' +
        '<p style="font-size:16px;font-weight:700;color:var(--negro);">Total adeudado: ' + formatMoney(totalAdeudado) + '</p>' +
        '<p style="font-size:13px;color:var(--gris);">Cuotas pagadas: ' + cuotasPagadas + '/' + totalCuotas + ' | Deudas activas: ' + deudas.length + '</p></div>';

    if (deudas.length === 0) {
        html += '<p>Sin deudas activas</p>';
    } else {
        html += '<h4 style="margin-bottom:12px;color:var(--turquesa-dark);">Detalle por deuda:</h4>';
        html += deudas.map(function(d, idx) {
            var hoy = new Date(); hoy.setHours(0,0,0,0);
            var venc = d.proxVencimiento ? new Date(d.proxVencimiento) : null;
            var vencida = venc && venc <= hoy;
            return '<div class="deuda-mini" style="border-left:3px solid ' + (vencida ? 'var(--rojo)' : 'var(--turquesa)') + ';">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<b>Deuda #' + (idx + 1) + '</b>' +
                '<span style="font-size:12px;color:' + (vencida ? 'var(--rojo)' : 'var(--gris)') + ';">' + (vencida ? '⚠️ Vencida' : 'Activa') + '</span></div>' +
                '<div>Fecha: ' + formatDate(d.fecha) + ' | Cuotas: ' + (d.cuotasPagadas || 0) + '/' + d.numCuotasTotal + '</div>' +
                '<div>Prox venc: ' + formatDate(d.proxVencimiento) + '</div>' +
                '<div style="font-size:18px;font-weight:800;color:var(--turquesa-dark);margin-top:8px;">' + formatMoney(d.saldoPendiente) + '</div>' +
                '<button class="btn" style="margin-top:10px;font-size:13px;padding:10px;" onclick="verDetalleDeuda('' + escapeHtml(d.id) + '')">Ver detalle / Pagar</button></div>';
        }).join('');
    }

    var detalleContent = document.getElementById('detalle-content');
    if (detalleContent) { detalleContent.innerHTML = html; showModal('modal-detalle'); }
}

// ============================================================
// DEUDAS
// ============================================================
function renderDeudas() {
    var deudas = getDeudas().filter(function(d) { return d.estado === 'activa'; });
    var container = document.getElementById('deudas-lista');
    if (!container) return;
    if (deudas.length === 0) { container.innerHTML = '<div class="empty">No hay deudas activas</div>'; return; }

    // UNIFICAR: Agrupar deudas por cliente
    var deudasPorCliente = {};
    for (var i = 0; i < deudas.length; i++) {
        var d = deudas[i];
        if (!deudasPorCliente[d.clienteId]) {
            deudasPorCliente[d.clienteId] = {
                clienteId: d.clienteId,
                clienteNombre: d.clienteNombre,
                deudas: [],
                totalPendiente: 0,
                totalCuotas: 0,
                cuotasPagadas: 0,
                proxVencimiento: null,
                vencida: false
            };
        }
        deudasPorCliente[d.clienteId].deudas.push(d);
        deudasPorCliente[d.clienteId].totalPendiente += (d.saldoPendiente || 0);
        deudasPorCliente[d.clienteId].totalCuotas += d.numCuotasTotal;
        deudasPorCliente[d.clienteId].cuotasPagadas += (d.cuotasPagadas || 0);
        // La fecha de vencimiento más cercana
        if (d.proxVencimiento) {
            var venc = new Date(d.proxVencimiento);
            var actual = deudasPorCliente[d.clienteId].proxVencimiento ? new Date(deudasPorCliente[d.clienteId].proxVencimiento) : null;
            if (!actual || venc < actual) {
                deudasPorCliente[d.clienteId].proxVencimiento = d.proxVencimiento;
            }
        }
    }

    // Verificar vencimiento
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    var clientesArray = [];
    for (var cid in deudasPorCliente) {
        var dc = deudasPorCliente[cid];
        if (dc.proxVencimiento) {
            var venc = new Date(dc.proxVencimiento); venc.setHours(0,0,0,0);
            dc.vencida = venc <= hoy;
        }
        clientesArray.push(dc);
    }

    // Ordenar por vencimiento más cercano (vencidas primero)
    clientesArray.sort(function(a, b) {
        if (a.vencida && !b.vencida) return -1;
        if (!a.vencida && b.vencida) return 1;
        var da = a.proxVencimiento ? new Date(a.proxVencimiento) : new Date('2099-01-01');
        var db = b.proxVencimiento ? new Date(b.proxVencimiento) : new Date('2099-01-01');
        return da - db;
    });

    container.innerHTML = clientesArray.map(function(dc) {
        var numDeudas = dc.deudas.length;
        return '<div class="deuda-item ' + (dc.vencida ? 'vencida' : '') + '" data-action="ver-cliente-deudas" data-id="' + escapeHtml(dc.clienteId) + '">' +
            '<div class="deuda-info"><b>' + escapeHtml(dc.clienteNombre) + '</b>' +
            ' | Deudas: ' + numDeudas +
            ' | Total pendiente: ' + formatMoney(dc.totalPendiente) +
            ' | Cuotas: ' + dc.cuotasPagadas + '/' + dc.totalCuotas +
            ' | Prox venc: ' + formatDate(dc.proxVencimiento) + '</div>' +
            '<div class="cliente-arrow">›</div></div>';
    }).join('');
}

function renderHistorialDeudas() {
    var deudas = getDeudas().filter(function(d) { return d.estado !== 'activa'; });
    var container = document.getElementById('deudas-historial-lista');
    if (!container) return;
    if (deudas.length === 0) { container.innerHTML = '<div class="empty">No hay deudas en historial</div>'; return; }
    container.innerHTML = deudas.map(function(d) {
        return '<div class="deuda-item pagada">' +
            '<div class="deuda-info"><b>' + escapeHtml(d.clienteNombre) + '</b> Total: ' + formatMoney(d.total) + ' | Pagado: ' + formatMoney((d.total || 0) - (d.saldoPendiente || 0)) + '</div>' +
            '<div class="deuda-estado">Pagada</div></div>';
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
    if (deudaCliente) deudaCliente.textContent = d.clienteNombre;
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
            return '<div class="pago-item"><b>Pago ' + (p.cuotaNum || '') + '</b> ' + formatDateTime(p.fecha) + '<br>' + formatMoney(p.monto) + ' (' + escapeHtml(p.metodo || 'efectivo') + ')</div>';
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
// CATALOGO - Slide pagination (drag to move, release to snap)
// ============================================================
var catalogoPaginaActual = 0;
var catalogoPaginas = [];
var catalogoItemsPorPagina = 10;

// Slide state
var catSlideStartX = 0;
var catSlideCurrentX = 0;
var catSlideDelta = 0;
var catSlideIsDragging = false;
var catSlideWrapper = null;

function renderCatalogo() {
    var productos = getProductos().filter(function(p) { return p.stock > 0; });
    var wrapper = document.getElementById('catalogo-pages-wrapper');
    var pageInfo = document.getElementById('cat-page-info');
    if (!wrapper) return;
    catSlideWrapper = wrapper;

    if (productos.length === 0) {
        wrapper.innerHTML = '<div class="product-grid catalogo-page"><div class="empty">No hay productos disponibles</div></div>';
        if (pageInfo) pageInfo.textContent = '0 / 0';
        catalogoPaginas = []; catalogoPaginaActual = 0;
        return;
    }

    catalogoPaginas = [];
    for (var i = 0; i < productos.length; i += catalogoItemsPorPagina) {
        catalogoPaginas.push(productos.slice(i, i + catalogoItemsPorPagina));
    }

    var html = '';
    for (var p = 0; p < catalogoPaginas.length; p++) {
        html += '<div class="product-grid catalogo-page" data-page="' + p + '">' +
            catalogoPaginas[p].map(function(prod) {
                var fotoHtml = prod.foto ? '<img src="' + escapeHtml(prod.foto) + '" class="cat-foto">' : '<div class="cat-foto-placeholder">🌸</div>';
                return '<div class="catalogo-card">' + fotoHtml +
                    '<div class="cat-nombre">' + escapeHtml(prod.nombre) + '</div>' +
                    '<div class="cat-precio">' + formatMoney(prod.precio) + '</div>' +
                    '<div class="cat-stock">Stock: ' + prod.stock + '</div></div>';
            }).join('') + '</div>';
    }
    wrapper.innerHTML = html;

    catalogoPaginaActual = 0;
    catalogoUpdateSlide(false);
    catalogoSetupSlide();
}

function catalogoUpdateSlide(animate) {
    if (!catSlideWrapper) return;
    var translate = -(catalogoPaginaActual * 100);
    catSlideWrapper.style.transition = animate ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
    catSlideWrapper.style.transform = 'translateX(' + translate + '%)';

    var pageInfo = document.getElementById('cat-page-info');
    var prevBtn = document.getElementById('cat-prev');
    var nextBtn = document.getElementById('cat-next');
    if (pageInfo) pageInfo.textContent = catalogoPaginas.length > 0 ? (catalogoPaginaActual + 1) + ' / ' + catalogoPaginas.length : '0 / 0';
    if (prevBtn) prevBtn.style.opacity = catalogoPaginaActual === 0 ? '0.3' : '1';
    if (nextBtn) nextBtn.style.opacity = catalogoPaginas.length === 0 || catalogoPaginaActual >= catalogoPaginas.length - 1 ? '0.3' : '1';
}

function catalogoNext() {
    if (catalogoPaginaActual < catalogoPaginas.length - 1) {
        catalogoPaginaActual++;
        catalogoUpdateSlide(true);
    }
}

function catalogoPrev() {
    if (catalogoPaginaActual > 0) {
        catalogoPaginaActual--;
        catalogoUpdateSlide(true);
    }
}

function catalogoSetupSlide() {
    var container = document.getElementById('catalogo-slide-container');
    if (!container) return;

    // Touch
    container.ontouchstart = function(e) {
        catSlideIsDragging = true;
        catSlideStartX = e.touches[0].clientX;
        catSlideCurrentX = catSlideStartX;
        catSlideDelta = 0;
        if (catSlideWrapper) catSlideWrapper.style.transition = 'none';
    };

    container.ontouchmove = function(e) {
        if (!catSlideIsDragging) return;
        catSlideCurrentX = e.touches[0].clientX;
        catSlideDelta = catSlideCurrentX - catSlideStartX;
        var baseTranslate = -(catalogoPaginaActual * 100);
        var containerWidth = container.offsetWidth || window.innerWidth;
        var percentDelta = (catSlideDelta / containerWidth) * 100;
        if (catSlideWrapper) catSlideWrapper.style.transform = 'translateX(' + (baseTranslate + percentDelta) + '%)';
        // Prevent vertical scroll during horizontal drag
        if (Math.abs(catSlideDelta) > 10) {
            e.preventDefault();
        }
    };

    container.ontouchend = function(e) {
        if (!catSlideIsDragging) return;
        catSlideIsDragging = false;
        var containerWidth = container.offsetWidth || window.innerWidth;
        var threshold = containerWidth * 0.25; // 25% threshold
        if (catSlideDelta < -threshold && catalogoPaginaActual < catalogoPaginas.length - 1) {
            catalogoPaginaActual++;
        } else if (catSlideDelta > threshold && catalogoPaginaActual > 0) {
            catalogoPaginaActual--;
        }
        catalogoUpdateSlide(true);
    };

    container.ontouchcancel = function() {
        catSlideIsDragging = false;
        catalogoUpdateSlide(true);
    };

    // Mouse (desktop testing)
    container.onmousedown = function(e) {
        catSlideIsDragging = true;
        catSlideStartX = e.clientX;
        catSlideCurrentX = catSlideStartX;
        catSlideDelta = 0;
        if (catSlideWrapper) catSlideWrapper.style.transition = 'none';
        e.preventDefault();
    };

    container.onmousemove = function(e) {
        if (!catSlideIsDragging) return;
        catSlideCurrentX = e.clientX;
        catSlideDelta = catSlideCurrentX - catSlideStartX;
        var baseTranslate = -(catalogoPaginaActual * 100);
        var containerWidth = container.offsetWidth || window.innerWidth;
        var percentDelta = (catSlideDelta / containerWidth) * 100;
        if (catSlideWrapper) catSlideWrapper.style.transform = 'translateX(' + (baseTranslate + percentDelta) + '%)';
    };

    container.onmouseup = function(e) {
        if (!catSlideIsDragging) return;
        catSlideIsDragging = false;
        var containerWidth = container.offsetWidth || window.innerWidth;
        var threshold = containerWidth * 0.25;
        if (catSlideDelta < -threshold && catalogoPaginaActual < catalogoPaginas.length - 1) {
            catalogoPaginaActual++;
        } else if (catSlideDelta > threshold && catalogoPaginaActual > 0) {
            catalogoPaginaActual--;
        }
        catalogoUpdateSlide(true);
    };

    container.onmouseleave = function() {
        if (catSlideIsDragging) {
            catSlideIsDragging = false;
            catalogoUpdateSlide(true);
        }
    };
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
    if (id === 'modal-producto') { editingProductId = null; fotoProductoBase64 = null; fotoProductoEditando = null; }
    if (id === 'modal-deuda-detalle') { editingDeudaId = null; }
    if (id === 'modal-cliente') { var cn = document.getElementById('cli-nombre'); var ct = document.getElementById('cli-telefono'); if (cn) cn.value = ''; if (ct) ct.value = ''; }
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
    return p && typeof p === 'object' && p.id && p.nombre && typeof p.precio === 'number' && p.precio >= 0 && typeof p.stock === 'number' && p.stock >= 0;
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
    if (!confirm('⚠️ Esto reemplazara todos los datos actuales. ¿Estas seguro?')) { input.value = ''; return; }
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
function setupEventDelegation() {
    document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target !== document.body) {
            var action = target.getAttribute('data-action');
            if (action) {
                var id = target.getAttribute('data-id');
                var idx = target.getAttribute('data-idx');
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
                    case 'upload-foto':
                        if (id) { e.stopPropagation(); subirFotoProducto(id); }
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
                    case 'ver-cliente-deudas':
                        if (id) { e.stopPropagation(); verDeudasCliente(id); }
                        return;
                }
            }
            target = target.parentElement;
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