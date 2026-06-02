// API Client - Connects React Frontend to .NET Backend
// All requests go through Vite proxy: /api → http://signmate.runasp.net/api

export const API_BASE = '/api';

// Helper: get JWT token from localStorage
const getToken = () => localStorage.getItem('accessToken');

// Helper: build headers
const headers = (isJson = true) => {
  const h = {};
  if (isJson) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

// Helper: translate English backend error to Vietnamese
const translateError = (message) => {
  if (!message) return 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
  const cleanErr = message.trim();
  if (cleanErr.includes('Invalid credentials') || cleanErr.includes('Sai email hoặc mật khẩu')) {
    return 'Email hoặc mật khẩu không chính xác.';
  }
  if (cleanErr.includes('Email already exists') || cleanErr.includes('Email đã được sử dụng')) {
    return 'Địa chỉ email này đã được sử dụng.';
  }
  if (cleanErr.includes('Invalid or expired OTP code')) {
    return 'Mã OTP không chính xác hoặc đã hết hạn.';
  }
  if (cleanErr.includes('Invalid refresh token') || cleanErr.includes('Refresh token expired')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (cleanErr.includes('Invalid request')) {
    return 'Yêu cầu không hợp lệ.';
  }
  if (cleanErr.includes('User not found') || cleanErr.includes('Teacher not found')) {
    return 'Không tìm thấy người dùng.';
  }
  if (cleanErr.includes('Invalid current password')) {
    return 'Mật khẩu hiện tại không chính xác.';
  }
  if (cleanErr.includes('Sign not found')) {
    return 'Không tìm thấy ký hiệu.';
  }
  if (cleanErr.includes('Session not found')) {
    return 'Không tìm thấy phiên luyện tập.';
  }
  if (cleanErr.includes('Session already ended')) {
    return 'Phiên luyện tập đã kết thúc.';
  }
  if (cleanErr.includes('Validation failed')) {
    return 'Dữ liệu đầu vào không hợp lệ.';
  }
  if (cleanErr.includes('Trung tâm không tồn tại')) {
    return 'Trung tâm không tồn tại.';
  }
  if (cleanErr.includes('Failed to fetch') || cleanErr.includes('NetworkError') || cleanErr.includes('network error')) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc đảm bảo máy chủ đã khởi động.';
  }
  return cleanErr;
};

// Intercept global fetch to catch and translate network connection errors centrally
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  try {
    return await originalFetch.apply(this, args);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Failed to connect')) {
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc đảm bảo máy chủ đã khởi động.');
    }
    throw err;
  }
};

// Helper: handle response
const handleResponse = async (res) => {
  if (res.status === 401) {
    // If we're on the login page, don't redirect — just show the error
    const isLoginPage = window.location.pathname === '/login';
    if (!isLoginPage) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userRole');
      window.location.href = '/login';
    }
    // Try to parse error message from response body
    try {
      const body = await res.json();
      throw new Error(translateError(body.message || 'Unauthorized'));
    } catch (e) {
      if (e.message && e.message !== 'Unauthorized') throw e;
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }
  }
  if (!res.ok) {
    const resClone = res.clone();
    try {
      const body = await res.json();
      throw new Error(translateError(body.message || `HTTP ${res.status}`));
    } catch (e) {
      if (e.message && !e.message.startsWith('Unexpected')) throw e;
      const text = await resClone.text();
      throw new Error(translateError(text || `HTTP ${res.status}`));
    }
  }
  const text = await res.text();
  if (!text) return null;
  const parsed = JSON.parse(text);

  // Unwrap ApiResponse envelopes (success, data, message, errors)
  if (parsed && typeof parsed === 'object' && 'success' in parsed) {
    if (parsed.success) {
      return parsed.data !== undefined ? parsed.data : parsed;
    } else {
      throw new Error(translateError(parsed.message || 'API Error'));
    }
  }
  return parsed;
};

// ============================
// AUTH
// ============================
export const authApi = {
  login: (email, password) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password }),
    }).then(handleResponse),

  sendRegisterOtp: (email) =>
    fetch(`${API_BASE}/auth/send-register-otp`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email }),
    }).then(handleResponse),

  register: (data) =>
    fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  me: () =>
    fetch(`${API_BASE}/users/me`, { headers: headers() }).then(handleResponse),
};

// ============================
// USERS (Super Admin)
// ============================
export const usersApi = {
  getAll: (role) => {
    const url = role ? `${API_BASE}/users?role=${role}` : `${API_BASE}/users`;
    return fetch(url, { headers: headers() }).then(handleResponse);
  },

  getById: (id) =>
    fetch(`${API_BASE}/users/${id}`, { headers: headers() }).then(handleResponse),

  update: (id, data) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: headers(),
    }).then(handleResponse),
};

// ============================
// DASHBOARD
// ============================
export const dashboardApi = {
  getOverview: () =>
    fetch(`${API_BASE}/dashboard`, { headers: headers() }).then(handleResponse),
  getProgressStats: () =>
    fetch(`${API_BASE}/dashboard/progress`, { headers: headers() }).then(handleResponse),
};

// ============================
// B2B CENTERS
// ============================
export const centersApi = {
  getAll: () =>
    fetch(`${API_BASE}/centers`, { headers: headers() }).then(handleResponse),

  getDashboard: (id) =>
    fetch(`${API_BASE}/centers/${id}/dashboard`, { headers: headers() }).then(handleResponse),

  getTeachers: (id) =>
    fetch(`${API_BASE}/centers/${id}/teachers`, { headers: headers() }).then(handleResponse),

  create: (data) =>
    fetch(`${API_BASE}/centers`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  createAdmin: (centerId, data) =>
    fetch(`${API_BASE}/centers/${centerId}/admin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  createTeacher: (centerId, data) =>
    fetch(`${API_BASE}/centers/${centerId}/teachers`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  getStudents: (centerId) =>
    fetch(`${API_BASE}/centers/${centerId}/students`, { headers: headers() }).then(handleResponse),

  createStudent: (centerId, data) =>
    fetch(`${API_BASE}/centers/${centerId}/students`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// ============================
// CLASSES
// ============================
export const classesApi = {
  getAll: (centerId) =>
    fetch(`${API_BASE}/centers/${centerId}/classes`, { headers: headers() }).then(handleResponse),

  create: (centerId, data) =>
    fetch(`${API_BASE}/centers/${centerId}/classes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  addStudents: (centerId, classId, studentIds) =>
    fetch(`${API_BASE}/centers/${centerId}/classes/${classId}/students`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ studentIds }),
    }).then(handleResponse),

  getStudents: (centerId, classId) =>
    fetch(`${API_BASE}/centers/${centerId}/classes/${classId}/students`, { headers: headers() }).then(handleResponse),
};

// ============================
// SUBSCRIPTIONS
// ============================
export const subscriptionApi = {
  getPlans: () =>
    fetch(`${API_BASE}/plans`, { headers: headers() }).then(handleResponse),

  getMyPlan: () =>
    fetch(`${API_BASE}/subscription/me`, { headers: headers() }).then(handleResponse),

  upgrade: (planId, returnUrl) =>
    fetch(`${API_BASE}/subscription/subscribe`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ planId, returnUrl }),
    }).then(handleResponse),

  getAll: () =>
    fetch(`${API_BASE}/subscription/all`, { headers: headers() }).then(handleResponse),
};

// ============================
// PROGRESS (Teacher)
// ============================
export const progressApi = {
  getClassProgress: (classId) =>
    fetch(`${API_BASE}/tracking/classes/${classId}/students`, { headers: headers() }).then(handleResponse),

  getCenterReports: (centerId) =>
    fetch(`${API_BASE}/tracking/centers/${centerId}/reports`, { headers: headers() }).then(handleResponse),
};

// ============================
// TEACHER
// ============================
export const teacherApi = {
  assignLesson: (centerId, classId, lessonId) =>
    fetch(`${API_BASE}/centers/${centerId}/classes/${classId}/lessons`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ lessonId }),
    }).then(handleResponse),

  addComment: (data) =>
    fetch(`${API_BASE}/teacher/comments`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// ============================
// B2B CONTACT (Public)
// ============================
export const contactApi = {
  submit: (data) =>
    fetch(`${API_BASE}/b2b/contact`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// ============================
// COURSES & LESSONS
// ============================
export const coursesApi = {
  getAll: (search, level, includeUnpublished = false) => {
    let url = `${API_BASE}/courses`;
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (level && level !== 'All') params.append('level', level);
    if (includeUnpublished) params.append('includeUnpublished', 'true');
    if (params.toString()) url += `?${params.toString()}`;
    return fetch(url, { headers: headers() }).then(handleResponse);
  },

  getById: (id) =>
    fetch(`${API_BASE}/courses/${id}`, { headers: headers() }).then(handleResponse),

  getLessons: (id) =>
    fetch(`${API_BASE}/courses/${id}/lessons`, { headers: headers() }).then(handleResponse),

  create: (data) =>
    fetch(`${API_BASE}/courses`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id, data) =>
    fetch(`${API_BASE}/courses/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id) =>
    fetch(`${API_BASE}/courses/${id}`, {
      method: 'DELETE',
      headers: headers(),
    }).then(handleResponse),
};

export const lessonsApi = {
  getById: (id) =>
    fetch(`${API_BASE}/lessons/${id}`, { headers: headers() }).then(handleResponse),

  create: (courseId, data) =>
    fetch(`${API_BASE}/lessons/course/${courseId}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id, data) =>
    fetch(`${API_BASE}/lessons/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id) =>
    fetch(`${API_BASE}/lessons/${id}`, {
      method: 'DELETE',
      headers: headers(),
    }).then(handleResponse),
};

// ============================
// GLOBAL ANALYTICS (Super Admin)
// ============================
export const analyticsApi = {
  getGlobal: () =>
    fetch(`${API_BASE}/analytics`, { headers: headers() }).then(handleResponse),
};


