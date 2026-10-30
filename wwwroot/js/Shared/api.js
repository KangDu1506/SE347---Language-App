// Gọi API backend (/api/*) kèm Bearer token của phiên Supabase (window.sb, tạo bởi js/supabase-client.js).
// Nạp SAU _SupabaseClient và TRƯỚC script của trang (cùng defer). Hướng dẫn: docs/frontend/API_CLIENT.md
//
//     const lesson = await AppApi.get(`/api/lessons/${id}`);
//     await AppApi.post(`/api/progress/lessons/${id}/open`);
//
// Lỗi được ném ra dạng AppApi.ApiError { status, message, body }:
//   status 0   = mất mạng / không gọi được server
//   status 401 = phiên hết hạn: tự chuyển về trang đăng nhập
//   còn lại    = mã HTTP; message lấy từ { error } trong response nếu có
(() => {
    class ApiError extends Error {
        constructor(status, message, body = null) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.body = body;
        }
    }

    async function getAccessToken() {
        if (!window.sb) return null;
        try {
            const { data } = await window.sb.auth.getSession();
            return data?.session?.access_token ?? null;
        } catch {
            return null;
        }
    }

    async function request(method, path, body) {
        const headers = { Accept: 'application/json' };
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';

        let response;
        try {
            response = await fetch(path, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body)
            });
        } catch {
            throw new ApiError(0, 'Network error');
        }

        if (response.status === 401) {
            window.location.assign('/Account/Login');
            throw new ApiError(401, 'Unauthorized');
        }

        const text = await response.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = null; }
        }

        if (!response.ok) {
            throw new ApiError(response.status, data?.error || response.statusText || `HTTP ${response.status}`, data);
        }
        return data;
    }

    window.AppApi = {
        get: path => request('GET', path),
        post: (path, body) => request('POST', path, body),
        ApiError
    };
})();
