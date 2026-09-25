/**
 * Tasks - Minimalist Daily Task Manager
 * Clean, lightweight, fully responsive, and focused.
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'dailyTodoTasks';
  const THEME_KEY = 'todo_theme';

  let tasks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let selectedPriority = 'none'; // 'none' | 'low' | 'medium' | 'high'
  let lastDeleted = null;
  let undoTimer = null;

  // DOM Elements
  const elements = {
    taskList: document.getElementById('taskList'),
    taskForm: document.getElementById('taskForm'),
    taskInput: document.getElementById('taskInput'),
    priorityPickerBtn: document.getElementById('priorityPickerBtn'),
    priorityLabel: document.getElementById('priorityLabel'),
    priorityMenu: document.getElementById('priorityMenu'),
    priorityOptions: document.querySelectorAll('.priority-option'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    countAll: document.getElementById('countAll'),
    countActive: document.getElementById('countActive'),
    countCompleted: document.getElementById('countCompleted'),
    activeItemsCount: document.getElementById('activeItemsCount'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    emptyState: document.getElementById('emptyState'),
    progressBarWrap: document.getElementById('progressBarWrap'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressSummary: document.getElementById('progressSummary'),
    progressPercent: document.getElementById('progressPercent'),
    currentDate: document.getElementById('currentDate'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================================================
  // Storage & Normalization
  // ==========================================================================
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item, idx) => ({
        id: item.id || `task_${Date.now()}_${idx}`,
        text: item.text || '',
        done: Boolean(item.done),
        priority: item.priority || 'none',
        createdAt: item.createdAt || Date.now()
      }));
    } catch (e) {
      console.error('Failed to load tasks:', e);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks:', e);
    }
  }

  // ==========================================================================
  // Render
  // ==========================================================================
  function render() {
    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.done).length;
    const activeCount = totalCount - completedCount;

    // Update Counts
    elements.countAll.textContent = totalCount;
    elements.countActive.textContent = activeCount;
    elements.countCompleted.textContent = completedCount;
    elements.activeItemsCount.textContent = `${activeCount} ${activeCount === 1 ? 'item' : 'items'} remaining`;

    // Clear completed button visibility
    elements.clearCompletedBtn.style.display = completedCount > 0 ? 'inline-block' : 'none';

    // Progress bar
    if (totalCount > 0) {
      elements.progressBarWrap.style.display = 'block';
      const pct = Math.round((completedCount / totalCount) * 100);
      elements.progressBarFill.style.width = `${pct}%`;
      elements.progressPercent.textContent = `${pct}%`;
      elements.progressSummary.textContent = `${completedCount} of ${totalCount} completed`;
    } else {
      elements.progressBarWrap.style.display = 'none';
    }

    // Filter & Search
    const query = searchQuery.trim().toLowerCase();
    const filtered = tasks.filter(task => {
      if (currentFilter === 'active' && task.done) return false;
      if (currentFilter === 'completed' && !task.done) return false;
      if (query && !task.text.toLowerCase().includes(query)) return false;
      return true;
    });

    elements.taskList.innerHTML = '';

    if (filtered.length === 0) {
      elements.emptyState.style.display = 'block';
      const emptyText = elements.emptyState.querySelector('.empty-text');
      if (query) {
        emptyText.textContent = `No tasks matching "${query}"`;
      } else if (currentFilter === 'active') {
        emptyText.textContent = 'No active tasks';
      } else if (currentFilter === 'completed') {
        emptyText.textContent = 'No completed tasks';
      } else {
        emptyText.textContent = 'No tasks yet';
      }
    } else {
      elements.emptyState.style.display = 'none';

      filtered.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.done ? 'completed' : ''}`;
        li.dataset.id = task.id;

        // Checkbox
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'task-checkbox-label';
        checkboxLabel.setAttribute('aria-label', `Mark task ${task.done ? 'incomplete' : 'complete'}`);

        const checkboxInput = document.createElement('input');
        checkboxInput.type = 'checkbox';
        checkboxInput.className = 'task-checkbox-input';
        checkboxInput.checked = task.done;
        checkboxInput.addEventListener('change', () => toggleTask(task.id));

        const customCheck = document.createElement('div');
        customCheck.className = 'checkbox-custom';
        customCheck.innerHTML = `
          <svg viewBox="0 0 16 16">
            <polyline points="3.5 8.5 6.5 11.5 12.5 4.5"></polyline>
          </svg>
        `;

        checkboxLabel.appendChild(checkboxInput);
        checkboxLabel.appendChild(customCheck);

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.textContent = task.text;
        textSpan.title = 'Double-click to edit';
        textSpan.addEventListener('dblclick', () => startInlineEdit(task.id, contentDiv, textSpan));

        contentDiv.appendChild(textSpan);

        // Priority pill (if set)
        if (task.priority && task.priority !== 'none') {
          const pill = document.createElement('span');
          pill.className = `priority-pill ${task.priority}`;
          pill.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
          contentDiv.appendChild(pill);
        }

        // Actions (Hover delete)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'task-actions';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-task-action delete';
        delBtn.setAttribute('aria-label', 'Delete task');
        delBtn.title = 'Delete';
        delBtn.innerHTML = `
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A1.75 1.75 0 0 0 9.25 1.5h-2.5A1.75 1.75 0 0 0 5 3.25zm1.75-.25a.25.25 0 0 0-.25.25V4h3v-.75a.25.25 0 0 0-.25-.25h-2.5zM6.05 6a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 6.05 6zm3.9 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 9.95 6z" clip-rule="evenodd"/>
          </svg>
        `;
        delBtn.addEventListener('click', () => deleteTask(task.id, li));

        actionsDiv.appendChild(delBtn);

        li.appendChild(checkboxLabel);
        li.appendChild(contentDiv);
        li.appendChild(actionsDiv);

        elements.taskList.appendChild(li);
      });
    }
  }

  // ==========================================================================
  // Task Actions
  // ==========================================================================
  function addTask() {
    const text = elements.taskInput.value.trim();
    if (!text) return;

    const newTask = {
      id: 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
      text,
      done: false,
      priority: selectedPriority,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();

    elements.taskInput.value = '';
    resetPriority();
    render();

    // Trigger enter animation on top item
    const firstLi = elements.taskList.querySelector('.task-item');
    if (firstLi) {
      firstLi.classList.add('animate-in');
    }
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.done = !task.done;
    saveTasks();
    render();
  }

  function deleteTask(id, li) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    const [deleted] = tasks.splice(idx, 1);
    lastDeleted = { task: deleted, index: idx };
    saveTasks();

    if (li) {
      li.classList.add('animate-out');
      setTimeout(() => {
        render();
        showUndoToast(`Task deleted`);
      }, 200);
    } else {
      render();
      showUndoToast(`Task deleted`);
    }
  }

  function startInlineEdit(id, contentDiv, textSpan) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = task.text;

    function finish(save) {
      if (save) {
        const val = input.value.trim();
        if (val && val !== task.text) {
          task.text = val;
          saveTasks();
        }
      }
      render();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });

    input.addEventListener('blur', () => finish(true));

    contentDiv.replaceChild(input, textSpan);
    input.focus();
    input.select();
  }

  function clearCompleted() {
    const completed = tasks.filter(t => t.done);
    if (completed.length === 0) return;

    tasks = tasks.filter(t => !t.done);
    saveTasks();
    render();
    showUndoToast(`Cleared ${completed.length} task${completed.length > 1 ? 's' : ''}`);
  }

  // ==========================================================================
  // Undo Toast
  // ==========================================================================
  function showUndoToast(msg) {
    clearTimeout(undoTimer);
    elements.toastContainer.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'toast';

    const text = document.createElement('span');
    text.textContent = msg;

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn-undo';
    undoBtn.textContent = 'Undo';
    undoBtn.onclick = () => {
      if (lastDeleted) {
        tasks.splice(lastDeleted.index, 0, lastDeleted.task);
        saveTasks();
        lastDeleted = null;
        render();
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 150);
      }
    };

    toast.appendChild(text);
    if (lastDeleted) toast.appendChild(undoBtn);
    elements.toastContainer.appendChild(toast);

    undoTimer = setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        toast.remove();
        lastDeleted = null;
      }, 150);
    }, 4000);
  }

  // ==========================================================================
  // Priority Picker
  // ==========================================================================
  function togglePriorityMenu() {
    const isOpen = elements.priorityMenu.style.display === 'flex';
    elements.priorityMenu.style.display = isOpen ? 'none' : 'flex';
  }

  function setPriority(prio) {
    selectedPriority = prio;
    elements.priorityMenu.style.display = 'none';

    elements.priorityOptions.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.prio === prio);
    });

    if (prio !== 'none') {
      elements.priorityLabel.textContent = prio;
      elements.priorityLabel.className = `priority-tag active`;
    } else {
      elements.priorityLabel.textContent = '';
      elements.priorityLabel.className = 'priority-tag';
    }
  }

  function resetPriority() {
    setPriority('none');
  }

  // ==========================================================================
  // Theme Management
  // ==========================================================================
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const active = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', active);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupListeners() {
    // Form submit
    elements.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addTask();
    });

    // Priority picker dropdown toggle
    elements.priorityPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePriorityMenu();
    });

    elements.priorityOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        setPriority(opt.dataset.prio);
      });
    });

    // Close dropdown on click outside
    document.addEventListener('click', () => {
      elements.priorityMenu.style.display = 'none';
    });

    // Search
    elements.searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      elements.clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      render();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      searchQuery = '';
      elements.clearSearchBtn.style.display = 'none';
      elements.searchInput.focus();
      render();
    });

    // Filter tabs
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        render();
      });
    });

    // Clear completed
    elements.clearCompletedBtn.addEventListener('click', clearCompleted);

    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === '/') {
        e.preventDefault();
        elements.searchInput.focus();
      }
    });

    // Date
    if (elements.currentDate) {
      elements.currentDate.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    initTheme();
    tasks = loadTasks();
    setupListeners();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
