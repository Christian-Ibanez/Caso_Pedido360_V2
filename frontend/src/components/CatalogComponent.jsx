import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import Layout from './Layout';
import { getCatalogProducts, createCatalogProduct, updateCatalogProduct, deleteCatalogProduct } from '../api/catalog';
import { getAccessToken, decodeClaims } from '../auth/token';

const CATEGORIES = ['Panaderia', 'Pasteleria', 'Cafeteria', 'Sandwiches', 'Bebidas'];

export default function CatalogComponent() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [roles, setRoles] = useState(account?.idTokenClaims?.roles || []);
  const isAdmin = roles.includes('Admin');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  // Modal Crear
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Panaderia');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('100');
  const [newDescription, setNewDescription] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal Editar
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!account) return;
      try {
        const token = await getAccessToken(instance, account);
        if (token) {
          const claims = decodeClaims(token);
          if (claims.roles) setRoles(claims.roles);
        }
      } catch (err) {
        console.error('Error obteniendo roles en CatalogComponent:', err);
      }
    };
    fetchRoles();
  }, [instance, account]);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCatalogProducts({
        q: searchTerm.trim() || undefined,
        category: categoryFilter || undefined,
        onlyActive: onlyActive || undefined
      });
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el catálogo de productos.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [categoryFilter, onlyActive]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts();
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await createCatalogProduct({
        sku: newSku.trim().toUpperCase(),
        name: newName.trim(),
        category: newCategory,
        price: parseFloat(newPrice),
        stock: parseInt(newStock, 10),
        description: newDescription.trim() || null,
        active: newActive
      });
      setSuccessMsg(`Producto "${newName}" creado exitosamente.`);
      setIsCreateOpen(false);
      // Reset form
      setNewSku('');
      setNewName('');
      setNewCategory('Panaderia');
      setNewPrice('');
      setNewStock('100');
      setNewDescription('');
      setNewActive(true);
      loadProducts();
    } catch (err) {
      setFormError(err.message || 'Error al crear el producto.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setEditName(product.name || '');
    setEditCategory(product.category || 'Panaderia');
    setEditPrice(product.price !== undefined ? product.price.toString() : '');
    setEditStock(product.stock !== undefined ? product.stock.toString() : '');
    setEditDescription(product.description || '');
    setEditActive(product.active !== false);
    setFormError('');
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setFormError('');
    setUpdating(true);
    try {
      await updateCatalogProduct(editingProduct.id, {
        name: editName.trim(),
        category: editCategory,
        price: parseFloat(editPrice),
        stock: parseInt(editStock, 10),
        description: editDescription.trim() || null,
        active: editActive
      });
      setSuccessMsg(`Producto "${editName}" actualizado exitosamente.`);
      setEditingProduct(null);
      loadProducts();
    } catch (err) {
      setFormError(err.message || 'Error al actualizar el producto.');
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickStockChange = async (product, delta) => {
    const newStockVal = Math.max(0, (product.stock || 0) + delta);
    try {
      await updateCatalogProduct(product.id, { stock: newStockVal });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStockVal } : p));
      setSuccessMsg(`Stock de ${product.name} actualizado a ${newStockVal}.`);
    } catch (err) {
      alert(`Error al ajustar stock: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`¿Estás seguro de eliminar el producto "${product.name}" (SKU: ${product.sku})?`)) {
      return;
    }
    try {
      await deleteCatalogProduct(product.id);
      setSuccessMsg(`Producto "${product.name}" eliminado correctamente.`);
      loadProducts();
    } catch (err) {
      alert(`Error al eliminar producto: ${err.message}`);
    }
  };

  const formatPrice = (val) => {
    const num = Number(val) || 0;
    return `$${num.toLocaleString('es-CL')}`;
  };

  const getStockBadge = (stock) => {
    const s = Number(stock) || 0;
    if (s <= 0) {
      return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', fontSize: '0.8rem' }}>Sin Stock (0)</span>;
    }
    if (s < 20) {
      return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 'bold', fontSize: '0.8rem' }}>Bajo Stock ({s})</span>;
    }
    return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 'bold', fontSize: '0.8rem' }}>En Stock ({s})</span>;
  };

  return (
    <Layout title="Catálogo de Productos e Inventario">
      <div>
        {/* Banner de servicio */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontWeight: 'bold', color: '#1e40af', fontSize: '1rem' }}>
              Microservicio: <code style={{ backgroundColor: '#dbeafe', color: '#1e3a8a' }}>ms-pedidos360-catalog</code> (Puerto 8082)
            </span>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#3b82f6' }}>
              Gestiona productos, categorías, precios y stock en tiempo real sincronizado con ms-pedidos360-orders.
            </p>
          </div>
          {isAdmin && (
            <button className="btn primary" onClick={() => { setIsCreateOpen(true); setFormError(''); }} style={{ whiteSpace: 'nowrap' }}>
              + Nuevo Producto
            </button>
          )}
        </div>

        {successMsg && (
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #f87171' }}>
            <strong>Error de conexión con el Catálogo:</strong> {error}
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
            <input
              type="text"
              placeholder="Buscar por nombre o SKU (ej. PAN-001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
            <button type="submit" className="btn" style={{ padding: '0.5rem 1rem' }}>Buscar</button>
          </form>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', marginRight: '0.5rem', color: '#4b5563' }}>Categoría:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              >
                <option value="">Todas las categorías</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: '#4b5563', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Solo Activos
            </label>

            <button onClick={loadProducts} className="btn" title="Recargar catálogo">
              ↻ Actualizar
            </button>
          </div>
        </div>

        {/* Tabla de Productos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando catálogo de productos...</div>
        ) : products.length > 0 ? (
          <div style={{ overflowX: 'auto', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#4b5563', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem' }}>SKU</th>
                  <th style={{ padding: '1rem' }}>Producto</th>
                  <th style={{ padding: '1rem' }}>Categoría</th>
                  <th style={{ padding: '1rem' }}>Precio (CLP)</th>
                  <th style={{ padding: '1rem' }}>Stock Disponible</th>
                  <th style={{ padding: '1rem' }}>Estado</th>
                  {isAdmin && <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones (Admin)</th>}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}>
                      <code style={{ fontWeight: 'bold', color: '#1e40af' }}>{p.sku}</code>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#111827' }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{p.description}</div>}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f3e8ff', color: '#6b21a8', fontSize: '0.8rem', fontWeight: '500' }}>
                        {p.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '700', color: '#111827' }}>
                      {formatPrice(p.price)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getStockBadge(p.stock)}
                        {isAdmin && (
                          <div style={{ display: 'inline-flex', gap: '0.2rem', marginLeft: '0.5rem' }}>
                            <button
                              onClick={() => handleQuickStockChange(p, -5)}
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', background: '#f9fafb' }}
                              title="Restar 5 unidades"
                            >
                              -5
                            </button>
                            <button
                              onClick={() => handleQuickStockChange(p, 10)}
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', background: '#f9fafb' }}
                              title="Sumar 10 unidades"
                            >
                              +10
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {p.active !== false ? (
                        <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '0.85rem' }}>● Activo</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontWeight: '600', fontSize: '0.85rem' }}>○ Inactivo</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            style={{ padding: '0.3rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#2563eb' }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            style={{ padding: '0.3rem 0.6rem', border: '1px solid #fecaca', borderRadius: '4px', background: '#fee2e2', cursor: 'pointer', fontSize: '0.8rem', color: '#b91c1c' }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
            No se encontraron productos en el catálogo con los filtros especificados.
          </div>
        )}

        {/* Modal Crear Producto */}
        {isCreateOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '2rem', width: '90%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, color: '#111827' }}>Agregar Nuevo Producto al Catálogo</h3>
                <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>

              {formError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #f87171' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateProduct}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>SKU *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. PAS-003"
                      value={newSku}
                      onChange={e => setNewSku(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Categoría</label>
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Nombre del Producto *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Medialuna con Dulce de Leche"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Precio en CLP *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      placeholder="ej. 1500"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Stock Inicial *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={newStock}
                      onChange={e => setNewStock(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Descripción</label>
                  <input
                    type="text"
                    placeholder="Detalles o ingredientes..."
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={newActive}
                      onChange={e => setNewActive(e.target.checked)}
                    />
                    Disponible para venta (Activo)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn" onClick={() => setIsCreateOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn primary" disabled={creating}>
                    {creating ? 'Guardando...' : 'Crear Producto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Editar Producto */}
        {editingProduct && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '2rem', width: '90%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, color: '#111827' }}>Editar Producto ({editingProduct.sku})</h3>
                <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>

              {formError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #f87171' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleUpdateProduct}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>SKU</label>
                    <input
                      type="text"
                      disabled
                      value={editingProduct.sku}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', backgroundColor: '#f3f4f6' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Categoría</label>
                    <select
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Precio en CLP</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Stock Disponible</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={editStock}
                      onChange={e => setEditStock(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Descripción</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={e => setEditActive(e.target.checked)}
                    />
                    Disponible para venta (Activo)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn" onClick={() => setEditingProduct(null)}>Cancelar</button>
                  <button type="submit" className="btn primary" disabled={updating}>
                    {updating ? 'Guardando...' : 'Actualizar Producto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
