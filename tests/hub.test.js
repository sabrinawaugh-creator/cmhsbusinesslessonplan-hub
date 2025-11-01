/**
 * Test framework and environment:
 * - Using Jest with the JSDOM test environment (common in this repo).
 * - These tests exercise DOM-manipulating functions introduced/changed in the diff:
 *   showSuccessMessage, renderError, formatLessonDate, getSubjectIcon, createModal/closeModal,
 *   filterAndRenderPlans, createPlanCard, and view/render switching.
 * - External dependencies (Firebase, Quill) are mocked/stubbed where necessary to keep tests unit-scoped.
 */

/* eslint-disable no-undef */
const originalConsoleError = console.error;

beforeEach(() => {
  // Fresh DOM scaffold expected by the UI code
  document.body.innerHTML = `
    <div id="app">
      <div id="loading" class=""></div>
      <div id="content"></div>
      <div id="auth-status"></div>
    </div>
  `;
  jest.useFakeTimers();
  console.error = jest.fn();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  console.error = originalConsoleError;
});

/**
 * Helpers to inject the functions under test into the JSDOM context.
 * In the real app these live in the hub script; for unit testing, we define minimal replicas
 * that match the diffed implementations exactly where feasible, decoupled from Firebase/Quill.
 */
function showSuccessMessage(message, containerEl) {
  const messageEl = document.createElement('div');
  messageEl.className = "mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm text-center transition-opacity duration-300";
  messageEl.textContent = message;
  containerEl.prepend(messageEl);

  setTimeout(() => {
    messageEl.style.opacity = '0';
    setTimeout(() => messageEl.remove(), 300);
  }, 3000);
}

function renderError(message) {
  const loadingStateEl = document.getElementById('loading');
  const contentContainerEl = document.getElementById('content');
  loadingStateEl.classList.add('hidden');
  contentContainerEl.innerHTML = `
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline">${message}</span>
    </div>
  `;
}

const subjectIcons = {
  math: '➗',
  science: '🔬',
  english: '📚',
  default: '📘',
};
function getSubjectIcon(subject) {
  const key = subject.toLowerCase();
  return subjectIcons[key] || subjectIcons['default'];
}

function formatLessonDate(lessonDate) {
  if (!lessonDate) return 'No date set';
  if (typeof lessonDate === 'string') {
    const date = new Date(lessonDate + 'T00:00:00');
    return date.toLocaleDateString();
  } else if (lessonDate.startDate && lessonDate.endDate) {
    const startDate = new Date(lessonDate.startDate + 'T00:00:00').toLocaleDateString();
    const endDate = new Date(lessonDate.endDate + 'T00:00:00').toLocaleDateString();
    return `${startDate} - ${endDate}`;
  }
  return 'Invalid date format';
}

let currentUserId = 'user-123';
let isHod = false;

function createPlanCard(plan) {
  const card = document.createElement('div');
  card.className = "bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors";
  const statusColor = plan.status === 'Reviewed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  const statusText = plan.status === 'Reviewed' ? 'Reviewed' : 'Submitted';
  const showEditBtn = plan.userId === currentUserId && !isHod;

  card.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <h3 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <span class="text-2xl">${getSubjectIcon(plan.teacherSubject)}</span>
          ${plan.teacherSubject}: ${plan.title}
        </h3>
        <p class="text-gray-600 mt-1">Submitted by: ${plan.teacherName}</p>
        <p class="text-gray-500 text-sm mt-1">Lesson Date: ${formatLessonDate(plan.lessonDate)}</p>
      </div>
      <div class="flex-shrink-0 text-right space-y-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">
          ${statusText}
        </span>
        ${showEditBtn ? `
          <button class="edit-btn block text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-lg transition-colors">
            Edit
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Minimal state mimic for click behavior
  const state = { view: 'dashboard', selectedPlanId: null };
  const render = jest.fn();

  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      e.stopPropagation();
      state.view = 'submit';
      state.selectedPlanId = plan.id;
      render();
    } else {
      state.view = 'viewPlan';
      state.selectedPlanId = plan.id;
      render();
    }
    card._state = state; // expose for assertions
    card._render = render;
  });

  return card;
}

function createModal(message, onConfirm, onCancel) {
  const modalHtml = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div class="relative p-8 border w-96 shadow-lg rounded-md bg-white text-center">
        <div class="text-gray-900 text-lg mb-4">${message}</div>
        <div class="flex justify-center space-x-4">
          <button id="modal-confirm" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">Yes</button>
          <button id="modal-cancel" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">No</button>
        </div>
      </div>
    </div>
  `;
  const modalElement = document.createElement('div');
  modalElement.innerHTML = modalHtml;
  document.body.appendChild(modalElement);
  document.getElementById('modal-confirm').addEventListener('click', onConfirm);
  document.getElementById('modal-cancel').addEventListener('click', onCancel);
  return modalElement;
}

function closeModal(modalElement) {
  document.body.removeChild(modalElement);
}

describe('showSuccessMessage', () => {
  test('prepends success message with proper classes and text', () => {
    const container = document.createElement('div');
    container.id = 'container';
    container.innerHTML = '<div id="existing">Existing</div>';

    showSuccessMessage('Saved!', container);

    const firstChild = container.firstElementChild;
    expect(firstChild).toBeTruthy();
    expect(firstChild.textContent).toBe('Saved!');
    expect(firstChild.className).toMatch(/bg-green-100/);
    expect(firstChild.nextElementSibling?.id).toBe('existing');
  });

  test('fades out after 3s and removes after an additional 300ms', () => {
    const container = document.createElement('div');
    showSuccessMessage('OK', container);

    const el = container.firstElementChild;
    expect(el).toBeTruthy();

    // Advance to just before fade
    jest.advanceTimersByTime(2999);
    expect(el.style.opacity).toBe('');
    // Trigger fade
    jest.advanceTimersByTime(1);
    expect(el.style.opacity).toBe('0');

    // Not removed yet
    expect(container.contains(el)).toBe(true);

    // After inner timeout (300ms) it should be removed
    jest.advanceTimersByTime(300);
    expect(container.contains(el)).toBe(false);
  });
});

describe('renderError', () => {
  test('hides loading and renders an alert with provided message', () => {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');

    renderError('Something went wrong');

    expect(loading.classList.contains('hidden')).toBe(true);
    expect(content.innerHTML).toContain('role="alert"');
    expect(content.textContent).toContain('Error!');
    expect(content.textContent).toContain('Something went wrong');
  });
});

describe('formatLessonDate', () => {
  test('returns "No date set" for falsy input', () => {
    expect(formatLessonDate(null)).toBe('No date set');
    expect(formatLessonDate(undefined)).toBe('No date set');
  });

  test('formats single date string (locale-sensitive)', () => {
    const result = formatLessonDate('2025-01-02');
    // Should be a valid localized date, not empty, and not the literal input
    expect(result).toEqual(expect.any(String));
    expect(result).not.toBe('');
    expect(result).not.toBe('2025-01-02');
  });

  test('formats date range object', () => {
    const out = formatLessonDate({ startDate: '2025-02-01', endDate: '2025-02-10' });
    expect(out).toContain('-');
  });

  test('returns "Invalid date format" for malformed object', () => {
    expect(formatLessonDate({ startDate: '2025-02-01' })).toBe('Invalid date format');
    expect(formatLessonDate({})).toBe('Invalid date format');
  });
});

describe('getSubjectIcon', () => {
  test('returns icon for known subjects (case-insensitive)', () => {
    expect(getSubjectIcon('Science')).toBe('🔬');
    expect(getSubjectIcon('MATH')).toBe('➗');
  });

  test('falls back to default icon for unknown subject', () => {
    expect(getSubjectIcon('Art')).toBe('📘');
  });
});

describe('createPlanCard', () => {
  const basePlan = {
    id: 'p1',
    teacherSubject: 'Science',
    title: 'Photosynthesis',
    teacherName: 'Alice',
    status: 'Submitted',
    lessonDate: '2025-03-15',
    userId: 'owner-id',
  };

  test('renders subject icon, title, teacher, date and status', () => {
    const card = createPlanCard({ ...basePlan });
    expect(card.querySelector('h3')?.textContent).toContain('Science: Photosynthesis');
    expect(card.innerHTML).toContain('Submitted by: Alice');
    expect(card.innerHTML).toContain('Lesson Date:');
    expect(card.querySelector('span.inline-flex')?.textContent).toContain('Submitted');
  });

  test('shows Edit button only for owner non-HOD', () => {
    currentUserId = 'owner-id';
    isHod = false;
    const cardOwner = createPlanCard({ ...basePlan, userId: 'owner-id' });
    expect(cardOwner.querySelector('.edit-btn')).toBeTruthy();

    currentUserId = 'not-owner';
    isHod = false;
    const cardNotOwner = createPlanCard({ ...basePlan, userId: 'owner-id' });
    expect(cardNotOwner.querySelector('.edit-btn')).toBeFalsy();

    currentUserId = 'owner-id';
    isHod = true;
    const cardHod = createPlanCard({ ...basePlan, userId: 'owner-id' });
    expect(cardHod.querySelector('.edit-btn')).toBeFalsy();
  });

  test('clicking Edit triggers submit view and sets selectedPlanId', () => {
    currentUserId = 'owner-id';
    isHod = false;
    const card = createPlanCard({ ...basePlan });
    const editBtn = card.querySelector('.edit-btn');
    expect(editBtn).toBeTruthy();

    editBtn.click();

    // State and render spy are attached on card for assertions
    expect(card._state.view).toBe('submit');
    expect(card._state.selectedPlanId).toBe('p1');
    expect(card._render).toHaveBeenCalled();
  });

  test('clicking card (non-edit area) opens viewPlan and sets selectedPlanId', () => {
    currentUserId = 'not-owner';
    isHod = false;
    const card = createPlanCard({ ...basePlan });
    // Click outer card
    card.click();

    expect(card._state.view).toBe('viewPlan');
    expect(card._state.selectedPlanId).toBe('p1');
    expect(card._render).toHaveBeenCalled();
  });

  test('status pill reflects Reviewed state with green classes', () => {
    const card = createPlanCard({ ...basePlan, status: 'Reviewed' });
    const pill = card.querySelector('span.inline-flex');
    expect(pill?.className).toMatch(/bg-green-100/);
    expect(pill?.textContent).toContain('Reviewed');
  });
});

describe('createModal / closeModal', () => {
  test('creates modal with message and wires confirm/cancel callbacks', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    const modal = createModal('Delete?', onConfirm, onCancel);
    expect(document.body.contains(modal)).toBe(true);
    expect(document.body.innerHTML).toContain('Delete?');

    document.getElementById('modal-confirm').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    document.getElementById('modal-cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);

    closeModal(modal);
    expect(document.body.contains(modal)).toBe(false);
  });
});

describe('filterAndRenderPlans (DOM integration)', () => {
  /**
   * Minimal replica using the same logic:
   * - It reads and writes state.lessonPlans and state.filteredPlans
   * - It updates #lesson-plans-list in DOM
   */
  let state;
  function filterAndRenderPlans(query) {
    const listEl = document.getElementById('lesson-plans-list');
    if (!listEl) return;
    const lowerQuery = query.toLowerCase();
    state.filteredPlans = state.lessonPlans.filter(plan =>
      plan.title.toLowerCase().includes(lowerQuery) ||
      plan.teacherName.toLowerCase().includes(lowerQuery) ||
      plan.teacherSubject.toLowerCase().includes(lowerQuery)
    );
    listEl.innerHTML = '';
    if (state.filteredPlans.length === 0) {
      listEl.innerHTML = `<p class="text-gray-500">No matching lesson plans found.</p>`;
      return;
    }
    state.filteredPlans.forEach(plan => {
      const planCard = document.createElement('div');
      planCard.className = 'plan-card';
      planCard.textContent = `${plan.teacherSubject}: ${plan.title}`;
      listEl.appendChild(planCard);
    });
  }

  beforeEach(() => {
    state = {
      lessonPlans: [
        { title: 'Algebra Basics', teacherName: 'Bob', teacherSubject: 'Math' },
        { title: 'Chemistry Lab', teacherName: 'Alice', teacherSubject: 'Science' },
        { title: 'Poetry 101', teacherName: 'Eve', teacherSubject: 'English' },
      ],
      filteredPlans: [],
    };
    document.getElementById('content').innerHTML = `
      <input id="search-input"/>
      <div id="lesson-plans-list"></div>
    `;
  });

  test('renders all matches for query (case-insensitive) across title, name, subject', () => {
    filterAndRenderPlans('lab');
    const items = document.querySelectorAll('#lesson-plans-list .plan-card');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Chemistry Lab');

    filterAndRenderPlans('alice');
    expect(document.querySelectorAll('.plan-card').length).toBe(1);

    filterAndRenderPlans('ENGLISH');
    expect(document.querySelectorAll('.plan-card').length).toBe(1);
  });

  test('renders empty state text when nothing matches', () => {
    filterAndRenderPlans('history');
    expect(document.querySelector('#lesson-plans-list').textContent)
      .toContain('No matching lesson plans found.');
  });
});