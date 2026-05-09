/* --- CẤU HÌNH HỆ THỐNG --- */
const SUPABASE_URL = 'https://csnnjdfrngfxtslrqfmp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbm5qZGZybmdmeHRzbHJxZm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDIyMTcsImV4cCI6MjA5MjQxODIxN30.Td5TsgdOVBNy1J_s5ap2MmMQ3t407TmUwvMi5nfil5Y';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let flowers = [], members = [], ownerships = [], notices = [], currentTab = 'flowers';
const COLOR_MAP = { 'Đỏ': '#dc2626', 'Cam': '#ea580c', 'Tím': '#9333ea', 'Lam': '#2563eb', 'Lục': '#16a34a' };
const ROLE_COLORS = { 'Hội Trưởng': '#dc2626', 'Hội Phó': '#ea580c', 'Quản Lý': '#9333ea', 'Tinh Anh': '#2563eb', 'Thành Viên': '#16a34a', 'Clone': '#000000' };
let cropper = null, currentFlowerId = null, currentMemberId = null;

/* --- XÁC THỰC TRUY CẬP --- */
const ACCESS_SESSION_KEY = 'tgh_access';
const ACCESS_DURATION = 5 * 60 * 1000; // 5 phút

async function verifyAccessPassword() {
    const inputPass = document.getElementById('access-password-input').value.trim();
    if (!inputPass) return showToast("Vui lòng nhập mật khẩu!", "error");

    try {
        const { data, error } = await supabaseClient
            .from('tgh_settings')
            .select('value')
            .eq('key', 'update_password')
            .single();
        if (error) throw error;

        if (inputPass === data.value) {
            sessionStorage.setItem(ACCESS_SESSION_KEY, Date.now());
            document.getElementById('accessModal').classList.add('hidden');
            fetchData();
        } else {
            showToast("Sai mật khẩu!", "error");
            document.getElementById('access-password-input').value = '';
        }
    } catch (e) {
        showToast("Lỗi: " + e.message, "error");
    }
}

function checkAccess() {
    const timestamp = sessionStorage.getItem(ACCESS_SESSION_KEY);
    if (timestamp && Date.now() - parseInt(timestamp) < ACCESS_DURATION) {
        document.getElementById('accessModal').classList.add('hidden');
        fetchData();
    }
    // Nếu không có hoặc hết hạn → giữ modal, focus vào input
    else {
        setTimeout(() => document.getElementById('access-password-input')?.focus(), 100);
    }
}

// Hàm tải dữ liệu Thành viên và Quyền sở hữu
async function fetchMembersData() {
    try {
        const [memberRes, ownRes] = await Promise.all([
            supabaseClient.from('tgh_members').select('*'),
            supabaseClient.from('tgh_ownership').select('*').order('updated_at', { ascending: false }).limit(10000)
        ]);
        if (memberRes.error) throw memberRes.error;
        if (ownRes.error) throw ownRes.error;
        members = memberRes.data || [];
        ownerships = ownRes.data || [];
    } catch (error) {
        console.error("Lỗi tải dữ liệu thành viên:", error);
    }
}

/* --- CÁC HÀM DÙNG CHUNG (TỐI ƯU) --- */
// Dọn dẹp trình cắt ảnh để tránh tốn RAM
function destroyCropper() {
    if (cropper) { cropper.destroy(); cropper = null; }
}

// Ẩn/Hiện nút Thêm-Sửa-Xóa (Dùng cho cả 2 tab quản lý)
function toggleButtons(type, mode) {
    const isEdit = (mode === 'edit');
    const addBtn = document.getElementById(`btn-${type}-add`);
    const editBtn = document.getElementById(`btn-${type}-edit`);
    const delBtn = document.getElementById(`btn-${type}-delete`);

    if (addBtn) addBtn.classList.toggle('hidden', isEdit);
    if (editBtn) editBtn.classList.toggle('hidden', !isEdit);
    if (delBtn) delBtn.classList.toggle('hidden', !isEdit);
}

// Khóa/Mở khóa nút bấm khi đang xử lý dữ liệu
function setBusy(btnId, isBusy) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isBusy) {
        // Lưu lại chữ gốc nếu chưa có
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.innerText;
        }
        btn.innerText = "Đang xử lý...";
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
    } else {
        // Trả về chữ gốc, nếu mất dữ liệu thì mặc định là "Xác nhận"
        btn.innerText = btn.dataset.originalText || "Xác nhận";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    }
}

// --- TẢI VÀ HIỂN THỊ DỮ LIỆU --- 
async function fetchData() {
    document.getElementById('loading-indicator')?.classList.remove('hidden');
    try {
        const [flowerRes, noticeRes] = await Promise.all([
            supabaseClient.from('tgh_flowers').select('*').order('name'),
            supabaseClient.from('tgh_notices').select('*').order('created_at', { ascending: false }),
        ]);
        await fetchMembersData();

        if (noticeRes.error) throw noticeRes.error;
        notices = noticeRes.data || [];

        if (flowerRes.error) throw flowerRes.error;
        flowers = flowerRes.data || [];

        refreshUI();
        document.getElementById('loading-indicator')?.classList.add('hidden');
    } catch (err) {
        document.getElementById('loading-indicator')?.classList.add('hidden');
        console.error("Lỗi tải dữ liệu:", err);
    }
}

function refreshUI() {
    if (currentTab === 'flowers') renderFlowers();
    else if (currentTab === 'members') renderMembers();
    else if (currentTab === 'notices') renderNotices();
    else if (currentTab === 'admin') {
        updateFlowerDroplist();
        updateMemberDroplist();
    }
}

// Hiển thị danh sách hoa tươi (Giao diện Khối + Thẻ chi tiết)
function renderFlowers(filter = '') {
    const container = document.getElementById('tab-flowers');
    if (!container) return;

    // Lọc dữ liệu: Hỗ trợ tìm kiếm tiếng Việt không dấu
    const normalizedFilter = removeVietnameseTones(filter);
    const filtered = flowers.filter(f => {
        const normalizedName = removeVietnameseTones(f.name);
        return normalizedName.includes(normalizedFilter);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-10 text-gray-400 text-center w-full text-[11px] tracking-widest">Không tìm thấy hoa phù hợp</div>`;
        return;
    }

    // 2. Cấu hình phân nhóm
    const sortOrder = ['Đỏ', 'Cam', 'Tím', 'Lam', 'Lục'];
    const groupedFlowers = filtered.reduce((acc, flower) => {
        const group = flower.color_group || 'Khác';
        if (!acc[group]) acc[group] = [];
        acc[group].push(flower);
        return acc;
    }, {});

    // Sử dụng space-y-4 để tạo khoảng cách giữa các khối nhóm hoa
    let html = '<div class="space-y-4">';

    sortOrder.forEach(colorName => {
        if (groupedFlowers[colorName] && groupedFlowers[colorName].length > 0) {

            // Sắp xếp A-Z
            const sortedGroup = groupedFlowers[colorName].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            const hexColor = COLOR_MAP[colorName] || '#000';

            // Mở đầu khối (Giống giao diện Quản lý)
            html += `<div class="group-container w-full md:w-[75%] mx-auto shadow-sm" style="border-left-color: ${hexColor}">
                <div class="group-header flex justify-between items-center mb-0 pb-2 border-b border-gray-100">
                    <span style="color: ${hexColor}">Hoa ${colorName.toUpperCase()} (${sortedGroup.length})</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            `;

            // Vẽ từng thẻ hoa bên trong
            sortedGroup.forEach(f => {
                const imageUrl = f.image_url ? f.image_url : 'https://csnnjdfrngfxtslrqfmp.supabase.co/storage/v1/object/public/img/macdinh.png';
                const ownerCount = ownerships.filter(o => o.flower_id == f.id).length;

                html += `
                    <div class="bg-[#fcfcfc] border border-gray-100 p-1 rounded-xl flex flex-col gap-2 cursor-pointer hover:shadow-md hover:bg-white transition-shadow" onclick="openFlowerModal(${f.id})">
                        <!-- HÀNG 1: Hình ảnh vuông bo góc + Tên hoa (cùng hàng) -->
                        <div class="flex items-center gap-2">
                            <img src="${imageUrl}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0 border" style="border-color: ${hexColor}40">
                            <div class="text-[11px] leading-tight flex-1 break-words" style="color: ${hexColor}">${f.name}</div>
                        </div>
                        
                        <!-- HÀNG 2: Thông tin số lượng thành viên -->
                        <div class="text-center text-[9px] text-gray-400 tracking-wide pt-1 border-t border-dashed border-gray-200">
                            ${ownerCount} thành viên sở hữu
                        </div>
                    </div>
                `;
            });

            html += `</div></div>`;
        }
    });

    html += '</div>'; // Đóng thẻ space-y-4
    container.className = "block"; // Trả về block vì lưới đã được định nghĩa bên trong từng khối
    container.innerHTML = html;
}

// Hiển thị danh sách Thành viên (Phân nhóm theo chức vụ)
function renderMembers(filter = '') {
    const container = document.getElementById('tab-members'); // Đảm bảo HTML của bạn có thẻ div id="tab-members"
    if (!container) return;

    // 1. Lọc theo từ khóa tìm kiếm (có hỗ trợ không dấu)
    const normalizedFilter = removeVietnameseTones(filter);
    const filtered = members.filter(m => {
        const normalizedName = removeVietnameseTones(m.name);
        return normalizedName.includes(normalizedFilter);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-10 text-gray-400 text-center w-full text-[11px] tracking-widest">Không tìm thấy thành viên phù hợp</div>`;
        return;
    }

    // 2. Cấu hình nhóm Chức vụ và Màu sắc viền khối
    const roleOrder = ['Hội Trưởng', 'Hội Phó', 'Quản Lý', 'Tinh Anh', 'Thành Viên', 'Clone'];

    // Gom nhóm
    const groupedMembers = filtered.reduce((acc, member) => {
        const role = member.role || 'Thành Viên';
        if (!acc[role]) acc[role] = [];
        acc[role].push(member);
        return acc;
    }, {});

    let html = '<div class="space-y-4">';

    roleOrder.forEach(roleName => {
        if (groupedMembers[roleName] && groupedMembers[roleName].length > 0) {

            // Sắp xếp A-Z
            const sortedGroup = groupedMembers[roleName].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            const hexColor = ROLE_COLORS[roleName] || '#16a34a';

            html += `<div class="group-container w-full md:w-[75%] mx-auto shadow-sm" style="border-left-color: ${hexColor}">
                <div class="group-header flex justify-between items-center mb-0 pb-2 border-b border-gray-100">
                    <span style="color: ${hexColor}">${roleName} (${sortedGroup.length})</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            `;

            sortedGroup.forEach(m => {
                const avatarUrl = m.avatar_url ? m.avatar_url : `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;

                // Đếm số lượng hoa thành viên này đang sở hữu
                const ownedFlowersCount = ownerships.filter(o => o.member_id == m.id).length;

                html += `
    <div class="bg-[#fcfcfc] border border-gray-100 p-1 rounded-xl flex flex-col gap-2 cursor-pointer hover:shadow-md hover:bg-white transition-shadow" onclick="openMemberModal(${m.id})">
        <div class="flex items-center gap-2">
            <img src="${avatarUrl}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0 border" style="border-color: ${hexColor}40">
            <div class="text-[11px] leading-tight flex-1 break-words" style="color: ${hexColor}">${m.name}</div>
        </div>
        <div class="text-center text-[9px] text-gray-400 tracking-wide pt-1 border-t border-dashed border-gray-200">
            ${ownedFlowersCount} hoa tươi
        </div>
    </div>
`;
            });

            html += `</div></div>`;
        }
    });

    html += '</div>';
    container.className = "block";
    container.innerHTML = html;
}

/* --- 3. QUẢN LÝ HOA TƯƠI (ADMIN) --- */

// Khởi tạo trình cắt: Khung cố định, di chuyển/zoom ảnh
function initCropper(event) {
    const file = event.target.files[0];
    if (!file) return;

    const img = document.getElementById('cropper-preview');
    const reader = new FileReader();

    reader.onload = (e) => {
        destroyCropper();
        img.style.display = 'block';
        img.src = e.target.result;

        img.onload = () => {
            // Luôn bật Cropper để có thể zoom ảnh dù ảnh gốc đã là 1:1
            setTimeout(() => {
                cropper = new Cropper(img, {
                    aspectRatio: 1,
                    viewMode: 1,             // Giữ ảnh không bị kéo tuột ra ngoài phần viền
                    dragMode: 'move',        // CHỐT 1: Cho phép kéo/di chuyển bức ảnh
                    autoCropArea: 1,         // Khung cắt bao phủ toàn bộ ô chứa
                    cropBoxMovable: false,   // CHỐT 2: Khóa vị trí khung cắt
                    cropBoxResizable: false, // CHỐT 3: Khóa kích thước, không cho kéo viền khung
                    zoomable: true,          // Cho phép cuộn chuột/dùng 2 ngón tay để zoom ảnh
                    toggleDragModeOnDblclick: false, // Tắt tính năng click đúp đổi chế độ
                    guides: true,
                    center: true,
                    background: false
                });
            }, 50);
        };
    };
    reader.readAsDataURL(file);
}

// 2. Cập nhật hàm lưu hoa hỗ trợ up ảnh gốc và xóa ảnh rác
async function saveFlower(mode) {
    const nameInput = document.getElementById('flower-name');
    const colorInput = document.getElementById('flower-color');
    const description = document.getElementById('flower-description').value.trim();
    const fileInput = document.getElementById('flower-image-input');

    const name = nameInput.value.trim();
    const color = getCustomSelectValue('flower-color');
    const btnId = mode === 'add' ? 'btn-flower-add' : 'btn-flower-edit';

    if (!name) return showToast("Vui lòng nhập tên hoa!");
    setBusy(btnId, true);

    try {
        let finalImageUrl = "";
        const fileName = `${formatFileName(name)}.png`;
        const hasNewImage = cropper || fileInput.files.length > 0;

        if (hasNewImage) {
            // Xóa ảnh cũ trên Supabase nếu đang sửa hoa
            if (mode === 'edit' && currentFlowerId) {
                const oldFlower = flowers.find(f => f.id == currentFlowerId);
                if (oldFlower && oldFlower.image_url) {
                    const oldFileName = oldFlower.image_url.split('/').pop();
                    await supabaseClient.storage.from('flowers').remove([oldFileName]);
                }
            }

            // Xử lý upload ảnh mới
            let fileToUpload;
            if (cropper) {
                const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
                fileToUpload = await dataURLtoBlob(canvas.toDataURL('image/png'));
            } else {
                fileToUpload = fileInput.files[0];
            }

            const { error: uploadError } = await supabaseClient.storage.from('flowers').upload(fileName, fileToUpload, { upsert: true });
            if (uploadError) throw uploadError;
            finalImageUrl = `${SUPABASE_URL}/storage/v1/object/public/flowers/${fileName}`;

        } else if (mode === 'edit' && currentFlowerId) {
            // Giữ nguyên ảnh cũ nếu không up ảnh mới
            const oldFlower = flowers.find(f => f.id == currentFlowerId);
            finalImageUrl = oldFlower ? oldFlower.image_url : "";
        }

        const payload = { name, color_group: color, image_url: finalImageUrl };

        if (mode === 'add') {
            const { data, error } = await supabaseClient.from('tgh_flowers').insert([payload]).select();
            if (error) throw error;
            flowers.push(data[0]);
        } else {
            const { error } = await supabaseClient.from('tgh_flowers').update(payload).eq('id', currentFlowerId);
            if (error) throw error;
            const idx = flowers.findIndex(f => f.id == currentFlowerId);
            flowers[idx] = { ...flowers[idx], ...payload };
        }

        showToast("Thao tác thành công!");
        resetFlowerForm();
        refreshUI();
    } catch (e) {
        showToast("Lỗi: " + e.message);
    } finally {
        setBusy(btnId, false);
    }
}

// Làm mới form nhập liệu
function resetFlowerForm() {
    currentFlowerId = null;

    // Reset input text
    document.getElementById('flower-name').value = '';
    document.getElementById('flower-description').value = '';

    // Reset custom dropdown
    resetCustomSelect('admin-flower-select');
    resetCustomSelect('flower-color');

    // Xóa ảnh
    document.getElementById('cropper-preview').src = '';
    document.getElementById('flower-image-input').value = '';

    // Reset nút và cropper
    toggleButtons('flower', 'add');
    destroyCropper();
}

/**
 * Xóa hoa tươi (Nâng cấp: Tự động xóa ảnh trên Storage)
 */
async function deleteFlower() {
    // Kiểm tra xem người dùng đã chọn hoa chưa
    if (!currentFlowerId || !confirm("Bạn có chắc chắn muốn xóa hoa này và ảnh liên quan?")) return;

    try {
        // Tìm thông tin hoa hiện tại để lấy URL ảnh
        const flowerToDelete = flowers.find(f => f.id === currentFlowerId);

        if (flowerToDelete && flowerToDelete.image_url) {
            // Bước 1: Trích xuất tên file từ URL
            // Ví dụ: .../flowers/hoa-hong_123.png -> lấy "hoa-hong_123.png"
            const urlParts = flowerToDelete.image_url.split('/');
            const fileName = urlParts[urlParts.length - 1];

            // Bước 2: Xóa file ảnh trên Supabase Storage
            const { error: storageError } = await supabaseClient.storage
                .from('flowers')
                .remove([fileName]);

            if (storageError) {
                console.warn("Lưu ý: Không thể xóa file ảnh hoặc file không tồn tại.", storageError);
            }
        }

        // Bước 3: Xóa bản ghi trong Database
        const { error: dbError } = await supabaseClient
            .from('tgh_flowers')
            .delete()
            .eq('id', currentFlowerId);

        if (dbError) throw dbError;

        // Bước 4: Cập nhật lại giao diện người dùng
        flowers = flowers.filter(f => f.id !== currentFlowerId);
        showToast("Đã xóa hoa tươi và ảnh thành công!");
        resetFlowerForm();
        refreshUI();

    } catch (e) {
        showToast("Lỗi khi xóa: " + e.message);
    }
}

/**
 * Cập nhật danh sách chọn hoa trong Admin
 * Tối ưu: Phân nhóm hoa theo phẩm màu để dễ quản lý và lựa chọn
 */
function updateFlowerDroplist() {
    const options = [];
    Object.keys(COLOR_MAP).forEach(colorName => {
        const flowersInColor = flowers.filter(f => f.color_group === colorName);
        if (flowersInColor.length > 0) {
            options.push({ isGroup: true, label: `Phẩm ${colorName}`, color: COLOR_MAP[colorName] });
            flowersInColor.forEach(f => {
                options.push({ value: String(f.id), label: f.name, color: COLOR_MAP[colorName] });
            });
        }
    });
    createCustomSelect('admin-flower-select', options, (val) => loadFlowerData(val), '-- Chọn hoa tươi để sửa --');
}

// Đổ dữ liệu hoa vào form khi chọn từ droplist
function loadFlowerData(id) {
    const f = flowers.find(x => x.id == id);
    if (!f) return resetFlowerForm();
    currentFlowerId = f.id;
    document.getElementById('flower-name').value = f.name;
    document.getElementById('flower-description').value = f.description || '';
    document.getElementById('cropper-preview').src = f.image_url;
    setCustomSelectValue('flower-color', f.color_group, `Phẩm ${f.color_group}`, COLOR_MAP[f.color_group]);
    toggleButtons('flower', 'edit');
}

/* --- 4. QUẢN LÝ THÀNH VIÊN (ADMIN) --- */

// Thêm/Sửa thành viên
async function saveMember(mode) {
    const name = document.getElementById('member-name').value.trim();
    const role = getCustomSelectValue('member-role');
    const btnId = mode === 'add' ? 'btn-member-add' : 'btn-member-edit';
    if (!name) return showToast("Vui lòng nhập tên!");

    setBusy(btnId, true);
    try {
        if (mode === 'add') {
            const { data, error } = await supabaseClient.from('tgh_members').insert([{ name, role }]).select();
            if (error) throw error;
            members.push(data[0]);
        } else {
            const { error } = await supabaseClient.from('tgh_members').update({ name, role }).eq('id', currentMemberId);
            if (error) throw error;
            const idx = members.findIndex(m => m.id == currentMemberId);
            members[idx] = { ...members[idx], name, role };
        }
        showToast("Đã lưu thành viên!");
        resetMemberForm();
        updateMemberDroplist();
    } catch (e) { showToast("Lỗi: " + e.message); }
    finally { setBusy(btnId, false); }
}

/**
 * Làm mới form thành viên và reset định dạng màu sắc
 */
function resetMemberForm() {
    currentMemberId = null;

    // Reset input text
    document.getElementById('member-name').value = '';

    // Reset custom dropdown
    resetCustomSelect('admin-member-select');
    resetCustomSelect('member-role');

    // Reset nút
    toggleButtons('member', 'add');
}

// Xóa thành viên
async function deleteMember() {
    if (!currentMemberId || !confirm("Xóa thành viên này?")) return;
    try {
        const { error } = await supabaseClient.from('tgh_members').delete().eq('id', currentMemberId);
        if (error) throw error;
        members = members.filter(m => m.id !== currentMemberId);
        showToast("Đã xóa!");
        resetMemberForm(); updateMemberDroplist();
    } catch (e) { showToast("Lỗi: " + e.message); }
}

/**
 * Cập nhật danh sách thành viên vào Droplist
 * Tối ưu: Phân nhóm theo chức vụ (Role) để dễ quản lý
 */
function updateMemberDroplist() {
    const roleOrder = ['Hội Trưởng', 'Hội Phó', 'Quản Lý', 'Tinh Anh', 'Thành Viên', 'Clone'];
    const options = [];

    roleOrder.forEach(roleName => {
        const membersInRole = members.filter(m => m.role === roleName);
        if (membersInRole.length > 0) {
            options.push({ isGroup: true, label: roleName, color: ROLE_COLORS[roleName] });
            membersInRole.forEach(m => {
                options.push({ value: String(m.id), label: m.name, color: ROLE_COLORS[roleName] });
            });
        }
    });

    createCustomSelect('admin-member-select', options, (val) => loadMemberData(val), '-- Chọn thành viên để sửa --');
}

// Đổ dữ liệu thành viên vào form khi chọn
function loadMemberData(id) {
    const m = members.find(x => x.id == id);
    if (!m) return resetMemberForm();
    currentMemberId = m.id;
    document.getElementById('member-name').value = m.name;
    setCustomSelectValue('member-role', m.role, m.role, ROLE_COLORS[m.role]);
    toggleButtons('member', 'edit');
}

/* --- 5. TIỆN ÍCH HỆ THỐNG --- */

// Chuyển tab
function showTab(tab) {
    currentTab = tab;

    // Xóa trắng ô tìm kiếm khi chuyển tab
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    ['flowers', 'members', 'notices', 'admin'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`btn-${t}`);
        if (el) el.classList.toggle('hidden', t !== tab);
        if (btn) btn.className = (t === tab) ? "tab-active" : "text-gray-400 hover:text-black";
    });

    if (tab === 'admin') {
        checkAuthState();
    } else {
        refreshUI();
    }
}

// Hàm chuyển tiếng Việt thành viết liền, không dấu, giữ nguyên In Hoa/In Thường
function formatFileName(str) {
    return str
        .normalize("NFD") // Tách phần dấu ra khỏi chữ cái
        .replace(/[\u0300-\u036f]/g, "") // Xóa toàn bộ dấu tiếng Việt
        .replace(/đ/g, "d").replace(/Đ/g, "D") // Xử lý chữ Đ/đ
        .replace(/[^a-zA-Z0-9]/g, ''); // Xóa tất cả khoảng trắng và ký tự đặc biệt (-, !, @,...)
}

function removeVietnameseTones(str) {
    if (!str) return "";
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Xóa dấu
        .replace(/đ/g, "d").replace(/Đ/g, "D") // Xử lý chữ đ
        .toLowerCase(); // Đưa về chữ thường
}

// Chuyển đổi Base64 từ Cropper thành Blob để upload
async function dataURLtoBlob(dataurl) {
    const res = await fetch(dataurl);
    return await res.blob();
}

// Modal chi tiết hoa (Hiển thị danh sách sở hữu)
function openFlowerModal(id) {
    const f = flowers.find(x => x.id === id);
    if (!f) return;

    document.body.classList.add('modal-open');

    // 1. Thông tin hoa
    const hexColor = COLOR_MAP[f.color_group] || '#000';
    const modalTitle = document.getElementById('modalTitle');
    modalTitle.innerHTML = `${f.name}<br><span style="font-size: 9px; font-style: italic; color: #000000;">Sự kiện: ${f.description || ''}</span>`;
    modalTitle.style.color = hexColor;

    const imageUrl = f.image_url || 'https://csnnjdfrngfxtslrqfmp.supabase.co/storage/v1/object/public/img/macdinh.png';
    const modalImg = document.getElementById('modalImg');
    modalImg.src = imageUrl;
    modalImg.style.borderColor = hexColor + '40';

    // 2. Danh sách thành viên sở hữu hoa này (data thật)
    const memberListContainer = document.getElementById('modalMemberList');
    const roleOrder = ['Hội Trưởng', 'Hội Phó', 'Quản Lý', 'Tinh Anh', 'Thành Viên', 'Clone'];
    const owners = ownerships
        .filter(o => o.flower_id == id)
        .sort((a, b) => {
            const memberA = members.find(m => m.id === a.member_id);
            const memberB = members.find(m => m.id === b.member_id);
            if (!memberA || !memberB) return 0;
            const roleCompare = roleOrder.indexOf(memberA.role) - roleOrder.indexOf(memberB.role);
            if (roleCompare !== 0) return roleCompare;
            return memberA.name.localeCompare(memberB.name, 'vi');
        });

    if (owners.length > 0) {
        memberListContainer.innerHTML = owners.map(o => {
            const member = members.find(m => m.id === o.member_id);
            if (!member) return '';
            const roleColor = ROLE_COLORS[member.role] || '#16a34a';
            const avatarUrl = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
            return `
            <div class="flex items-center gap-2 text-[11px] p-2 bg-gray-50 rounded-lg border-l-2" style="border-left-color: ${roleColor}">
                <img src="${avatarUrl}" class="w-6 h-6 rounded-full object-cover flex-shrink-0">
                <span class="flex-1" style="color: ${roleColor}">${member.name}</span>
                <span class="text-[9px] text-gray-400 tracking-wide">${member.role}</span>
            </div>
        `;
        }).join('');
    } else {
        memberListContainer.innerHTML = `<div class="text-center text-[10px] text-gray-400 py-4 tracking-widest">Chưa có thành viên nào sở hữu</div>`;
    }

    // 3. Hiệu ứng mở modal
    const modal = document.getElementById('flowerModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        const content = document.getElementById('modalContent');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// Hàm đóng Modal chi tiết (Đã fix lỗi mất class giao diện)
function closeFlowerModal() {
    const content = document.getElementById('modalContent');
    const modal = document.getElementById('flowerModal');

    document.body.classList.remove('modal-open');

    // 1. Chỉ gỡ hiệu ứng Mở và thêm hiệu ứng Đóng (không xóa các class nền, viền)
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    // 2. Chờ 200ms cho hiệu ứng thu nhỏ chạy xong rồi mới ẩn hẳn khối nền đen
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function toggleCollapse(btn, contentOverride) {
    const content = contentOverride || btn.parentElement.nextElementSibling;
    if (content) {
        const isHidden = content.classList.toggle('hidden');
        btn.innerText = isHidden ? '+' : '-';
        btn.parentElement.classList.toggle('rounded-xl', isHidden);
        btn.parentElement.classList.toggle('rounded-t-xl', !isHidden);
    }
}

/* --- KHỞI CHẠY --- */
document.addEventListener('DOMContentLoaded', () => {
    checkAccess();

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const keyword = e.target.value;
        if (currentTab === 'flowers') renderFlowers(keyword);
        else if (currentTab === 'members') renderMembers(keyword);
        else if (currentTab === 'notices') renderNotices(keyword);
    });

    // Refresh session timestamp khi user tương tác
    ['click', 'keydown', 'touchstart'].forEach(event => {
        document.addEventListener(event, () => {
            if (sessionStorage.getItem(ACCESS_SESSION_KEY)) {
                sessionStorage.setItem(ACCESS_SESSION_KEY, Date.now());
            }
        }, { passive: true });
    });
});

/* --- 6. XỬ LÝ AUTH (ĐĂNG NHẬP/ĐĂNG XUẤT) --- */
// Hàm thực hiện đăng nhập
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!email || !password) return showToast("Vui lòng nhập đầy đủ!", "error");

    setBusy('btn-login', true);
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Đăng nhập thành công!");
        document.getElementById('admin-login-form').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        updateFlowerDroplist();
        updateMemberDroplist();
        updateNoticeDroplist();
        initAdminDropdowns();
    } catch (e) {
        showToast("Sai email hoặc mật khẩu!", "error");
    } finally {
        setBusy('btn-login', false);
    }
}

// Hàm đăng xuất
async function handleLogout() {
    await supabaseClient.auth.signOut();
    document.getElementById('admin-content').classList.add('hidden');
    document.getElementById('admin-login-form').classList.remove('hidden');
    showToast("Đã đăng xuất!");
}

// Kiểm tra trạng thái đăng nhập để ẩn/hiện form tương ứng
async function checkAuthState() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const loginForm = document.getElementById('admin-login-form');
    const adminContent = document.getElementById('admin-content');
    if (session) {
        loginForm?.classList.add('hidden');
        adminContent?.classList.remove('hidden');
        // Đồng bộ lại droplist sau khi đăng nhập
        updateFlowerDroplist();
        updateMemberDroplist();
        updateNoticeDroplist();
        initAdminDropdowns();
    } else {
        loginForm?.classList.remove('hidden');
        adminContent?.classList.add('hidden');
    }
}

/**
 * Hiển thị thông báo thân thiện (Toast)
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo: 'success' (mặc định) hoặc 'error'
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const baseStyle = "bg-black/80 text-white";
    const icon = type === 'success' ? '✓' : '✕';
    const textColor = type === 'success' ? 'text-white' : 'text-red-400';
    toast.className = `${baseStyle} px-6 py-3 rounded-full shadow-xl text-[10px] font-bold flex items-center gap-3 toast mb-3 w-max whitespace-nowrap justify-center`;

    toast.innerHTML = `
        <span class="${textColor}">${icon}</span> 
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Tự động xóa sau 2.5 giây
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}

/* --- MODAL THÀNH VIÊN (1 MODAL, NHIỀU BƯỚC) --- */

let selectedFlowerIds = new Set();

// Hàm chuyển bước trong modal
/*function showMemStep(step) {
    ['stats', 'flowers'].forEach(s => {
        document.getElementById(`mem-step-${s}`).classList.add('hidden');
    });
    document.getElementById(`mem-step-${step}`).classList.remove('hidden');

    const modalContent = document.getElementById('memberModalContent');
    if (step === 'flowers') {
        modalContent.classList.remove('max-w-[320px]');
        modalContent.classList.add('md:max-w-[640px]');
    } else {
        modalContent.classList.add('max-w-[320px]');
        modalContent.classList.remove('md:max-w-[640px]');
    }
}*/

function showMemStep(step) {
    // Ẩn tất cả các step
    ['stats', 'flowers', 'view'].forEach(s => {
        const el = document.getElementById(`mem-step-${s}`);
        if (el) el.classList.add('hidden');
    });

    // Hiện step mục tiêu
    const target = document.getElementById(`mem-step-${step}`);
    if (target) target.classList.remove('hidden');

    const modalContent = document.getElementById('memberModalContent');
    // Cả step flowers và view đều mở rộng form ra 640px
    if (step === 'flowers' || step === 'view') {
        modalContent.classList.remove('max-w-[320px]');
        modalContent.classList.add('md:max-w-[640px]');
    } else {
        modalContent.classList.add('max-w-[320px]');
        modalContent.classList.remove('md:max-w-[640px]');
    }
}

// Mở modal thành viên
function openMemberModal(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    document.body.classList.add('modal-open');

    currentMemberId = memberId;

    document.getElementById('memModalName').innerText = member.name;
    document.getElementById('memModalImg').src = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;

    renderMemberFlowerStats(memberId);
    showMemStep('stats');

    const modal = document.getElementById('memberModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        const content = document.getElementById('memberModalContent');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// Đóng modal thành viên
function closeMemberModal() {
    const content = document.getElementById('memberModalContent');
    document.body.classList.remove('modal-open');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => document.getElementById('memberModal').classList.add('hidden'), 200);
}

function renderMemberFlowerStats(memberId) {
    const statsContainer = document.getElementById('memFlowerStats');
    const memberOwns = ownerships.filter(o => o.member_id == memberId);

    const counts = { 'Đỏ': 0, 'Cam': 0, 'Tím': 0, 'Lam': 0, 'Lục': 0 };
    memberOwns.forEach(own => {
        const flower = flowers.find(f => f.id === own.flower_id);
        if (flower && counts[flower.color_group] !== undefined) {
            counts[flower.color_group]++;
        }
    });

    statsContainer.innerHTML = Object.keys(counts).map(color => {
        const hexColor = COLOR_MAP[color] || '#ccc';
        // Đã xóa onclick, cursor-pointer và hover
        return `
    <div class="flex items-center justify-between text-[11px] p-2 bg-gray-50 rounded-lg border-l-2" 
         style="border-left-color: ${hexColor}">
        <span style="color: ${hexColor}">Hoa ${color}</span>
        <span class="text-[9px] text-gray-400 tracking-wide">${counts[color]} hoa</span>
    </div>
`;
    }).join('');
}

// Xác minh password
async function verifyPassword() {
    const inputPass = document.getElementById('update-password-input').value.trim();
    if (!inputPass) return showToast("Vui lòng nhập mật khẩu!", "error");

    try {
        const { data, error } = await supabaseClient
            .from('tgh_settings')
            .select('value')
            .eq('key', 'update_password')
            .single();

        if (error) throw error;

        if (inputPass === data.value) {
            // Đúng pass → load danh sách hoa đã chọn rồi chuyển bước
            selectedFlowerIds = new Set(
                ownerships.filter(o => o.member_id == currentMemberId).map(o => o.flower_id)
            );
            document.getElementById('flower-select-search').value = '';
            renderFlowerSelectList();
            showMemStep('flowers');
        } else {
            showToast("Sai mật khẩu!", "error");
        }
    } catch (e) {
        showToast("Lỗi xác minh: " + e.message, "error");
    }
}

function renderFlowerSelectList(filter = '') {
    const container = document.getElementById('flowerSelectList');
    const sortOrder = ['Đỏ', 'Cam', 'Tím', 'Lam', 'Lục'];
    const normalizedFilter = removeVietnameseTones(filter);

    const groupedFlowers = flowers.reduce((acc, flower) => {
        const group = flower.color_group || 'Khác';
        if (!acc[group]) acc[group] = [];
        acc[group].push(flower);
        return acc;
    }, {});

    let html = '';
    sortOrder.forEach(colorName => {
        if (!groupedFlowers[colorName]) return;

        const hexColor = COLOR_MAP[colorName] || '#000';
        const sortedGroup = groupedFlowers[colorName]
            .filter(f => removeVietnameseTones(f.name).includes(normalizedFilter))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

        if (sortedGroup.length === 0) return;

        // Đếm số lượng hoa ĐÃ CHỌN trong nhóm này lúc vừa mở form
        const selectedCount = sortedGroup.filter(f => selectedFlowerIds.has(f.id)).length;

        html += `
            <div class="group-container" style="border-left-color: ${hexColor}">
                <div id="header-count-${colorName}" class="group-header pb-2 border-b border-gray-100" style="color: ${hexColor}">
                    Hoa ${colorName.toUpperCase()} (${selectedCount}/${sortedGroup.length})
                </div>
                <div id="grid-color-${colorName}" class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
        `;

        sortedGroup.forEach(f => {
            const isSelected = selectedFlowerIds.has(f.id);
            const imageUrl = f.image_url || 'https://csnnjdfrngfxtslrqfmp.supabase.co/storage/v1/object/public/img/macdinh.png';

            // Thêm lệnh updateFlowerCountUI vào sự kiện onclick để "chọn tới đâu đếm tới đó"
            html += `
                <div class="p-1 rounded-xl flex flex-col gap-2 cursor-pointer transition-shadow ${isSelected ? 'bg-white shadow-md' : 'bg-[#fcfcfc]'}"
                    id="flower-select-card-${f.id}"
                    style="${isSelected ? `border: 1px solid ${hexColor}` : 'border: 1px solid #f3f4f6'}"
                    onclick="toggleFlowerSelect(${f.id}, '${hexColor}'); updateFlowerCountUI('${colorName}');">
                    <div class="flex items-center gap-2">
                        <img src="${imageUrl}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0">
                        <div class="text-[11px] leading-tight flex-1 break-words" style="color: ${hexColor}">${f.name}</div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html || `<div class="text-center text-[11px] text-gray-400 py-6 tracking-widest uppercase">Không tìm thấy hoa phù hợp</div>`;
}

function updateFlowerCountUI(colorName) {
    const header = document.getElementById(`header-count-${colorName}`);
    const grid = document.getElementById(`grid-color-${colorName}`);
    
    if (!header || !grid) return;

    // Lấy tất cả các thẻ hoa trong phẩm màu này
    const cards = grid.querySelectorAll('[id^="flower-select-card-"]');
    const totalCount = cards.length;
    let selectedCount = 0;

    // Đếm xem có bao nhiêu ID đang nằm trong mảng selectedFlowerIds
    cards.forEach(card => {
        const flowerId = parseInt(card.id.replace('flower-select-card-', ''));
        if (selectedFlowerIds.has(flowerId)) {
            selectedCount++;
        }
    });

    // Cập nhật lại tiêu đề realtime
    header.innerText = `Hoa ${colorName.toUpperCase()} (${selectedCount}/${totalCount})`;
}

// Toggle chọn/bỏ chọn hoa
function toggleFlowerSelect(flowerId, hexColor) {
    const card = document.getElementById(`flower-select-card-${flowerId}`);
    if (selectedFlowerIds.has(flowerId)) {
        selectedFlowerIds.delete(flowerId);
        card.style.border = '1px solid #f3f4f6';
        card.classList.remove('bg-white', 'shadow-md');
        card.classList.add('bg-[#fcfcfc]');
    } else {
        selectedFlowerIds.add(flowerId);
        card.style.border = `1px solid ${hexColor}`;
        card.classList.add('bg-white', 'shadow-md');
        card.classList.remove('bg-[#fcfcfc]');
    }
}

// Lưu dữ liệu sở hữu
async function saveOwnership() {
    const saveBtn = document.querySelector('#mem-step-flowers .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...'; }
    try {
        // Lấy danh sách hoa hiện tại trong DB
        const { data: existingRows, error: fetchError } = await supabaseClient
            .from('tgh_ownership')
            .select('flower_id')
            .eq('member_id', currentMemberId);
        if (fetchError) throw fetchError;

        const existingIds = new Set(existingRows.map(r => r.flower_id));

        // Xóa hoa bị bỏ chọn
        const toDelete = [...existingIds].filter(id => !selectedFlowerIds.has(id));
        if (toDelete.length > 0) {
            const { error: deleteError } = await supabaseClient
                .from('tgh_ownership')
                .delete()
                .eq('member_id', currentMemberId)
                .in('flower_id', toDelete);
            if (deleteError) throw deleteError;
        }

        // Thêm hoa mới được chọn
        const toInsert = [...selectedFlowerIds].filter(id => !existingIds.has(id));
        if (toInsert.length > 0) {
            const { error: insertError } = await supabaseClient
                .from('tgh_ownership')
                .insert(toInsert.map(flowerId => ({
                    member_id: currentMemberId,
                    flower_id: flowerId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })));
            if (insertError) throw insertError;
        }

        // Fetch lại ownerships từ DB
        // Đợi Supabase commit xong
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch lại ownerships từ DB
        const { data: freshOwn, error: ownError } = await supabaseClient
            .from('tgh_ownership')
            .select('*')
            .limit(10000);
        if (!ownError && freshOwn) {
            ownerships = freshOwn;
        }

        showToast("Cập nhật thành công!");

        // Cập nhật thống kê và quay về bước 1
        renderMemberFlowerStats(currentMemberId);
        renderMembers();
        showMemStep('stats');

    } catch (e) {
        showToast("Lỗi lưu dữ liệu: " + e.message, "error");
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Xác nhận'; }
    }
}

// Đổi mật khẩu cập nhật
async function changeUpdatePassword() {
    const currentPass = document.getElementById('current-password').value.trim();
    const newPass = document.getElementById('new-password').value.trim();
    const confirmPass = document.getElementById('confirm-password').value.trim();

    if (!currentPass || !newPass || !confirmPass) return showToast("Vui lòng nhập đầy đủ!", "error");
    if (newPass !== confirmPass) return showToast("Mật khẩu mới không khớp!", "error");
    if (newPass.length < 4) return showToast("Mật khẩu tối thiểu 4 ký tự!", "error");

    try {
        // Kiểm tra mật khẩu hiện tại
        const { data, error } = await supabaseClient
            .from('tgh_settings')
            .select('value')
            .eq('key', 'update_password')
            .single();
        if (error) throw error;
        if (currentPass !== data.value) return showToast("Mật khẩu hiện tại không đúng!", "error");

        // Cập nhật mật khẩu mới
        const { error: updateError } = await supabaseClient
            .from('tgh_settings')
            .update({ value: newPass })
            .eq('key', 'update_password');
        if (updateError) throw updateError;

        showToast("Đổi mật khẩu thành công!");
        resetPasswordForm();
    } catch (e) {
        showToast("Lỗi: " + e.message, "error");
    }
}

function resetPasswordForm() {
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
}

// Placeholder cho thông báo (sẽ code sau)
// Thêm/Sửa thông báo
let currentNoticeId = null;

async function saveNotice(mode) {
    const title = document.getElementById('notice-title').value.trim();
    const content = document.getElementById('notice-content').value.trim();
    if (!title) return showToast("Vui lòng nhập tiêu đề!", "error");
    if (!content) return showToast("Vui lòng nhập nội dung!", "error");

    const btnId = mode === 'add' ? 'btn-notice-add' : 'btn-notice-edit';
    setBusy(btnId, true);
    try {
        if (mode === 'add') {
            const { data, error } = await supabaseClient
                .from('tgh_notices')
                .insert([{ title, content }])
                .select();
            if (error) throw error;
            notices.unshift(data[0]);
        } else {
            const { error } = await supabaseClient
                .from('tgh_notices')
                .update({ title, content })
                .eq('id', currentNoticeId);
            if (error) throw error;
            const idx = notices.findIndex(n => n.id === currentNoticeId);
            notices[idx] = { ...notices[idx], title, content };
        }
        showToast("Thao tác thành công!");
        resetNoticeForm();
        updateNoticeDroplist();
        if (currentTab === 'notices') renderNotices();
    } catch (e) {
        showToast("Lỗi: " + e.message, "error");
    } finally {
        setBusy(btnId, false);
    }
}

async function deleteNotice() {
    if (!currentNoticeId) return;
    try {
        const { error } = await supabaseClient
            .from('tgh_notices')
            .delete()
            .eq('id', currentNoticeId);
        if (error) throw error;
        notices = notices.filter(n => n.id !== currentNoticeId);
        showToast("Xóa thành công!");
        resetNoticeForm();
        updateNoticeDroplist();
        if (currentTab === 'notices') renderNotices();
    } catch (e) {
        showToast("Lỗi: " + e.message, "error");
    }
}

function resetNoticeForm() {
    currentNoticeId = null;
    document.getElementById('notice-title').value = '';
    document.getElementById('notice-content').value = '';
    resetCustomSelect('admin-notice-select');
    toggleButtons('notice', 'add');
}

function updateNoticeDroplist() {
    const options = notices.map(n => ({
        value: String(n.id),
        label: n.title,
        color: '#000'
    }));
    createCustomSelect('admin-notice-select', options, (val) => loadNoticeData(val), '-- Chọn thông báo để sửa --');
}

function loadNoticeData(id) {
    if (!id) return resetNoticeForm();
    const notice = notices.find(n => n.id == id);
    if (!notice) return;
    currentNoticeId = notice.id;
    document.getElementById('notice-title').value = notice.title;
    document.getElementById('notice-content').value = notice.content;
    toggleButtons('notice', 'edit');
}

// Hiển thị danh sách thông báo
function renderNotices(filter = '') {
    const container = document.getElementById('tab-notices');
    if (!container) return;

    const normalizedFilter = removeVietnameseTones(filter);
    const filtered = notices.filter(n =>
        removeVietnameseTones(n.title).includes(normalizedFilter) ||
        removeVietnameseTones(n.content).includes(normalizedFilter)
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-10 text-gray-400 text-center w-full text-[11px] tracking-widest">Chưa có thông báo nào</div>`;
        return;
    }

    const html = filtered.map(n => {
        const date = new Date(n.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `
        <div class="group-container w-full md:w-[75%] mx-auto shadow-sm mb-4" style="border-left-color: #000">
            <div class="group-header flex justify-between items-center mb-0 cursor-pointer"
                onclick="toggleCollapse(this.querySelector('button'), this.nextElementSibling)">
                <span class="text-black">${n.title}</span>
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-gray-400 tracking-wide font-normal normal-case">${date}</span>
                    <button class="w-6 h-6 flex items-center justify-center border border-current rounded-full hover:bg-black hover:text-white transition-colors flex-shrink-0">+</button>
                </div>
            </div>
            <div class="content-body hidden pt-2 border-t border-gray-100 mt-2">
                <p class="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">${n.content}</p>
            </div>
        </div>
    `;
    }).join('');

    container.innerHTML = `<div class="space-y-4">${html}</div>`;
    container.className = 'block';
}

/* --- CUSTOM DROPDOWN --- */
function createCustomSelect(wrapperId, options, onChangeFn, placeholder = '-- Chọn --') {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    wrapper.innerHTML = `
        <div class="custom-select-wrapper" id="${wrapperId}-wrapper">
            <button type="button" class="custom-select-trigger" id="${wrapperId}-trigger">
                <span id="${wrapperId}-label" class="truncate">${placeholder}</span>
            </button>
            <div class="custom-select-options" id="${wrapperId}-options"></div>
        </div>
    `;

    renderCustomSelectOptions(wrapperId, options, placeholder);

    const trigger = document.getElementById(`${wrapperId}-trigger`);
    const optionsEl = document.getElementById(`${wrapperId}-options`);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = optionsEl.classList.contains('open');
        closeAllCustomSelects();
        if (!isOpen) {
            optionsEl.classList.add('open');
            trigger.classList.add('open');
        }
    });

    wrapper._onChange = onChangeFn;
    wrapper._placeholder = placeholder;
}

function renderCustomSelectOptions(wrapperId, options, placeholder) {
    const optionsEl = document.getElementById(`${wrapperId}-options`);
    if (!optionsEl) return;

    let html = `<div class="custom-select-option text-gray-400" data-value="">${placeholder}</div>`;
    options.forEach(opt => {
        if (opt.isGroup) {
            html += `<div class="custom-select-group" style="color: ${opt.color || '#9ca3af'}">${opt.label}</div>`;
        } else {
            html += `<div class="custom-select-option" data-value="${opt.value}" style="color: ${opt.color || '#000'}">${opt.label}</div>`;
        }
    });
    optionsEl.innerHTML = html;

    optionsEl.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const value = opt.dataset.value;
            const label = opt.textContent;
            const color = opt.style.color || '#000';

            const trigger = document.getElementById(`${wrapperId}-trigger`);
            const labelEl = document.getElementById(`${wrapperId}-label`);
            labelEl.textContent = label;
            labelEl.style.color = value ? color : '#9ca3af';
            trigger.classList.remove('open');
            optionsEl.classList.remove('open');

            const wrapper = document.getElementById(wrapperId);
            wrapper._value = value;
            if (wrapper._onChange) wrapper._onChange(value);
        });
    });
}

function closeAllCustomSelects() {
    document.querySelectorAll('.custom-select-options.open').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.custom-select-trigger.open').forEach(el => el.classList.remove('open'));
}

function getCustomSelectValue(wrapperId) {
    return document.getElementById(wrapperId)?._value || '';
}

function setCustomSelectValue(wrapperId, value, label, color) {
    const wrapper = document.getElementById(wrapperId);
    const labelEl = document.getElementById(`${wrapperId}-label`);
    const trigger = document.getElementById(`${wrapperId}-trigger`);
    if (!wrapper || !labelEl) return;
    wrapper._value = value;
    labelEl.textContent = label || wrapper._placeholder;
    labelEl.style.color = value ? (color || '#000') : '#9ca3af';
}

function resetCustomSelect(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    wrapper._value = '';
    const labelEl = document.getElementById(`${wrapperId}-label`);
    const trigger = document.getElementById(`${wrapperId}-trigger`);
    if (labelEl) {
        labelEl.textContent = wrapper._placeholder || '-- Chọn --';
        labelEl.style.color = '#9ca3af';
    }
    if (trigger) {
        trigger.classList.remove('open');
    }
    const optionsEl = document.getElementById(`${wrapperId}-options`);
    if (optionsEl) optionsEl.classList.remove('open');

    // Bỏ selected trên tất cả option
    optionsEl?.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.classList.remove('selected');
    });
}

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', closeAllCustomSelects);

function initAdminDropdowns() {
    createCustomSelect('flower-color', [
        { value: 'Đỏ', label: 'Phẩm Đỏ', color: COLOR_MAP['Đỏ'] },
        { value: 'Cam', label: 'Phẩm Cam', color: COLOR_MAP['Cam'] },
        { value: 'Tím', label: 'Phẩm Tím', color: COLOR_MAP['Tím'] },
        { value: 'Lam', label: 'Phẩm Lam', color: COLOR_MAP['Lam'] },
        { value: 'Lục', label: 'Phẩm Lục', color: COLOR_MAP['Lục'] },
    ], () => { }, 'Chọn phẩm màu');

    createCustomSelect('member-role', [
        { value: 'Clone', label: 'Clone', color: ROLE_COLORS['Clone'] },
        { value: 'Thành Viên', label: 'Thành Viên', color: ROLE_COLORS['Thành Viên'] },
        { value: 'Tinh Anh', label: 'Tinh Anh', color: ROLE_COLORS['Tinh Anh'] },
        { value: 'Quản Lý', label: 'Quản Lý', color: ROLE_COLORS['Quản Lý'] },
        { value: 'Hội Phó', label: 'Hội Phó', color: ROLE_COLORS['Hội Phó'] },
        { value: 'Hội Trưởng', label: 'Hội Trưởng', color: ROLE_COLORS['Hội Trưởng'] },
    ], () => { }, 'Chọn chức vụ');
}


// Xem hoa mem
function showFlowersByColorView() {
    showMemStep('view');

    // Lấy tên thành viên và đổi tiêu đề ---
    const memberName = document.getElementById('memModalName').innerText;
    const titleEl = document.getElementById('mem-view-main-title');
    if (titleEl) {
        titleEl.innerText = `HOA TƯƠI ${memberName} ĐANG SỞ HỮU`;
    }

    const container = document.getElementById('mem-view-list');
    container.scrollTop = 0;

    // Lấy tất cả ID hoa mà thành viên hiện tại sở hữu
    const ownedFlowerIds = ownerships
        .filter(o => o.member_id == currentMemberId)
        .map(o => o.flower_id);

    // Nếu chưa có hoa nào thì báo trống
    if (ownedFlowerIds.length === 0) {
        container.innerHTML = `<div class="text-center text-[11px] text-gray-400 py-10 tracking-widest">Thành viên chưa sở hữu hoa nào</div>`;
        return;
    }

    const sortOrder = ['Đỏ', 'Cam', 'Tím', 'Lam', 'Lục'];
    let html = '';

    // Duyệt qua từng màu để nhóm lại
    sortOrder.forEach(colorName => {
        // Lọc hoa theo màu hiện tại VÀ thành viên có sở hữu
        const ownedFlowersInColor = flowers
            .filter(f => f.color_group === colorName && ownedFlowerIds.includes(f.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

        // Nếu màu này không có hoa nào thì bỏ qua, chạy sang màu tiếp theo
        if (ownedFlowersInColor.length === 0) return;

        const hexColor = COLOR_MAP[colorName] || '#000';

        // Bọc trong group-container, thêm mb-4 để cách các nhóm màu với nhau
        html += `
            <div class="group-container mb-4" style="border-left-color: ${hexColor}">
                <div class="group-header pb-2 border-b border-gray-100" style="color: ${hexColor}">
                    Hoa ${colorName.toUpperCase()} (${ownedFlowersInColor.length})
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
        `;

        // Đổ danh sách hoa của màu đó
        ownedFlowersInColor.forEach(f => {
            const imageUrl = f.image_url || 'https://csnnjdfrngfxtslrqfmp.supabase.co/storage/v1/object/public/img/macdinh.png';

            html += `
                <div class="p-1 rounded-xl flex flex-col gap-2 bg-[#fcfcfc]"
                    id="flower-view-card-${f.id}"
                    style="border: 1px solid #f3f4f6">
                    <div class="flex items-center gap-2">
                        <img src="${imageUrl}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0">
                        <div class="text-[11px] leading-tight flex-1 break-words" style="color: ${hexColor}">${f.name}</div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}
