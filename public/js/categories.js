/**
 * Categories Page Controller
 */

let allCategories = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;

  currentUser = auth.getUser();
  auth.renderNavbar('categories');

  const isManagerOrAdmin = currentUser.role === 'Manager' || currentUser.role === 'Admin';
  if (!isManagerOrAdmin) {
    const addBtn = document.getElementById('btn-add-category');
    if (addBtn) addBtn.style.display = 'none';
  }

  await loadCategories();

  document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
});

async function loadCategories() {
  const loadingEl = document.getElementById('categories-loading');
  const tableEl = document.getElementById('categories-table');
  loadingEl.classList.remove('d-none');
  tableEl.classList.add('d-none');

  try {
    const response = await api.get('/categories');
    allCategories = response.data || [];
    renderCategoriesTable(allCategories);
  } catch (err) {
    showNotification('Failed to load categories: ' + err.message, 'danger');
  } finally {
    loadingEl.classList.add('d-none');
    tableEl.classList.remove('d-none');
  }
}

function renderCategoriesTable(categories) {
  const tbody = document.getElementById('categories-tbody');
  const emptyEl = document.getElementById('categories-empty');
  const isManagerOrAdmin = currentUser.role === 'Manager' || currentUser.role === 'Admin';

  if (!categories || categories.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }

  emptyEl.classList.add('d-none');
  tbody.innerHTML = categories.map(c => `
    <tr>
      <td>
        <div class="fw-bold fs-6">${c.category_name}</div>
        <small class="text-muted">ID: ${c.category_id}</small>
      </td>
      <td>${c.description || '<span class="text-muted">—</span>'}</td>
      <td>
        <span class="badge ${c.is_active ? 'bg-success' : 'bg-secondary'}">
          ${c.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="text-end">
        ${isManagerOrAdmin ? `
          <button class="btn btn-outline-primary btn-sm" onclick="openEditCategoryModal(${c.category_id})">
            ✏️ Edit
          </button>
        ` : '<span class="text-muted small">Read-only</span>'}
      </td>
    </tr>
  `).join('');
}

function openAddCategoryModal() {
  document.getElementById('category-modal-title').textContent = 'Add Product Category';
  document.getElementById('category-id').value = '';
  document.getElementById('category-form').reset();
  document.getElementById('category-error-alert').classList.add('d-none');

  const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
  modal.show();
}

function openEditCategoryModal(categoryId) {
  const c = allCategories.find(item => item.category_id === categoryId);
  if (!c) return;

  document.getElementById('category-modal-title').textContent = 'Edit Category: ' + c.category_name;
  document.getElementById('category-id').value = c.category_id;
  document.getElementById('cat-name').value = c.category_name;
  document.getElementById('cat-desc').value = c.description || '';
  document.getElementById('category-error-alert').classList.add('d-none');

  const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
  modal.show();
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('category-error-alert');
  const saveBtn = document.getElementById('save-category-btn');
  alertEl.classList.add('d-none');
  saveBtn.disabled = true;

  const categoryId = document.getElementById('category-id').value;
  const isEdit = !!categoryId;

  const payload = {
    categoryName: document.getElementById('cat-name').value.trim(),
    description: document.getElementById('cat-desc').value.trim() || null
  };

  try {
    if (isEdit) {
      await api.put(`/categories/${categoryId}`, payload);
      showNotification(`Category ${payload.categoryName} updated successfully!`, 'success');
    } else {
      await api.post('/categories', payload);
      showNotification(`Category ${payload.categoryName} created successfully!`, 'success');
    }

    const modalEl = document.getElementById('categoryModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    await loadCategories();
  } catch (err) {
    alertEl.textContent = err.message || 'Operation failed.';
    alertEl.classList.remove('d-none');
  } finally {
    saveBtn.disabled = false;
  }
}
