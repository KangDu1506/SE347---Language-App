// Tạo Supabase client dùng chung (window.sb) từ thẻ meta do Pages/Shared/_SupabaseClient.cshtml render.
(() => {
    const url = document.querySelector('meta[name="supabase-url"]')?.content;
    const key = document.querySelector('meta[name="supabase-publishable-key"]')?.content;

    if (!url || !key || !window.supabase) {
        console.error('Chưa cấu hình Supabase:Url / Supabase:PublishableKey hoặc không tải được supabase-js.');
        return;
    }

    window.sb = window.supabase.createClient(url, key);
})();
