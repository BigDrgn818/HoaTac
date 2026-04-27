let allFlowers = [];
let editingUser = null;
let currentRole = "guest"; // guest | mod | admin
/*let canEdit = false; // chỉ true sau khi nhập đúng pw*/
const EDIT_PASSWORD = "hoatac";

const client = window.supabase.createClient(
  "https://csnnjdfrngfxtslrqfmp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbm5qZGZybmdmeHRzbHJxZm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDIyMTcsImV4cCI6MjA5MjQxODIxN30.Td5TsgdOVBNy1J_s5ap2MmMQ3t407TmUwvMi5nfil5Y"
);

async function loadFlowers() {
  const { data } = await client.from("flowers").select("*");
  allFlowers = data || [];
}
loadFlowers();

/* SEARCH 
function handleSearch() {
  const keyword = document.getElementById("searchInput").value.toLowerCase().trim();
  const activeTab = document.querySelector(".nav-item.active").innerText;

  // 🔥 HOA TƯƠI
  if (activeTab.includes("HOA")) {
    if (!keyword) {
      renderFlowerGrid(); // quay về mặc định
      return;
    }

    const filtered = allFlowers.filter(f =>
      f.flower_name.toLowerCase().includes(keyword)
    );

    renderFlowerFiltered(filtered);
  }

  // 🔥 THÀNH VIÊN
  if (activeTab.includes("THÀNH")) {
    if (!keyword) {
      renderUserGrid(); // quay về mặc định
      return;
    }

    const filtered = allUsers.filter(u =>
      u.name.toLowerCase().includes(keyword)
    );

    renderUserFiltered(filtered);
  }
}*/

/* SELECT */
function selectFlower(id, name, img) {
  /*document.getElementById("suggestions").innerHTML = "";*/

  const tagText = document.getElementById("tagText");
  tagText.innerText = name;

  // 🔥 thêm dòng này
  tagText.style.color = getColor(
    allFlowers.find(f => String(f.id) === String(id))?.flower_type
  );
  document.getElementById("tagImg").src = img || "";
  document.getElementById("selectedTag").classList.remove("hidden");

  renderResult(id);
}

function selectUser(name) {
  const user = allUsers.find(u => u.name === name);
  if (!user) return;

  const box = document.getElementById("result");

  const list = allFlowers.filter(f =>
    (user.flowers || []).includes(String(f.id))
  );

  box.innerHTML = `
    <div class="group">
      <div class="group-header">
  <div class="group-title">
    ${user.name} (${list.length} hoa)
  </div>

  <i class="edit-btn" onclick="startEditUser('${user.name}')">
  [Cập nhật hoa]
</i>
</div>

      <div class="grid">
        ${list.map(f => `
          <div class="grid-item">
            <img src="${f.flower_img || ''}">
            
            <span>
              <span style="color:${getColor(f.flower_type)}">
                ${f.flower_name}
              </span>
              <br>
              <small>${f.flower_type}</small>
            </span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* CLEAR */
document.getElementById("tagRemove").onclick = () => {
  document.getElementById("selectedTag").classList.add("hidden");

  const input = document.getElementById("searchInput");
  input.value = "";
  input.focus();

  const activeTab = document.querySelector(".nav-item.active").innerText;

  if (activeTab.includes("HOA")) {
    renderFlowerGrid();
  } else if (activeTab.includes("THÀNH")) {
    renderUserGrid();
  }
};

/* RESULT */
async function renderResult(id) {
  const box = document.getElementById("result");

  const { data } = await client
    .from("users")
    .select("*")
    .contains("flowers", [String(id)]);

  const list = data || [];

  const sorted = [...list].sort((a, b) =>
    (b.flowers?.length || 0) - (a.flowers?.length || 0)
  );

  box.innerHTML = `
  <div class="group">
    <div class="group-title">Thành viên sở hữu (${list.length})</div>

    <div class="grid">
      ${sorted.map(u => `
        <div class="grid-item">
          <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&size=64">

          <span>
            ${u.name}
            <br>
            <small style="color:#666">
              ${u.flowers?.length || 0} hoa
            </small>
          </span>
        </div>
      `).join("")}
    </div>
  </div>
`;
}

/* NAV */
const tabs = document.querySelectorAll(".nav-item");

tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    // 🔥 reset search UI
    /*document.getElementById("suggestions").innerHTML = "";*/
    document.getElementById("searchInput").value = "";
    document.getElementById("selectedTag").classList.add("hidden");

    const text = tab.innerText;
    //ẨN SEARCHBOX ADMIN
    const searchBox = document.querySelector(".search-wrapper");

    if (text.includes("QUẢN")) {
      searchBox.style.display = "none";
    } else {
      searchBox.style.display = "block";
    }

    if (!text.includes("QUẢN")) {
      canEdit = false; // 🔒 rời khỏi là khóa
    }

    if (text.includes("HOA")) {
      renderFlowerGrid();
    }

    if (text.includes("THÀNH")) {
      renderUserGrid();
    }

    if (text.includes("QUẢN")) {
      openLoginModal();
    }
  };
});

let allUsers = [];

/* LOAD USERS */
async function loadUsers() {
  const { data } = await client.from("users").select("*");
  allUsers = data || [];
}
loadUsers();

/* SORT HOA */
function sortFlowers() {
  const order = ["Đỏ", "Cam", "Tím", "Lam", "Lục"];

  return [...allFlowers].sort((a, b) => {
    const d = order.indexOf(a.flower_type) - order.indexOf(b.flower_type);
    if (d !== 0) return d;
    return a.flower_name.localeCompare(b.flower_name, "vi");
  });
}

/* RENDER HOA GRID */
function renderFlowerGrid() {
  const box = document.getElementById("result");

  const order = ["Đỏ", "Cam", "Tím", "Lam", "Lục"];

  const grouped = {};

  // group
  allFlowers.forEach(f => {
    if (!grouped[f.flower_type]) grouped[f.flower_type] = [];
    grouped[f.flower_type].push(f);
  });

  // sort A-Z
  Object.keys(grouped).forEach(type => {
    grouped[type].sort((a, b) =>
      a.flower_name.localeCompare(b.flower_name, "vi")
    );
  });

  box.innerHTML = order.map(type => {
    if (!grouped[type]) return "";

    return `
  <div class="group ${getGroupClass(type)}">
    <div class="group-title">${type} (${grouped[type].length})</div>

    <div class="grid">
      ${grouped[type].map(f => `
        <div class="grid-item" onclick="selectFlower('${f.id}','${f.flower_name}','${f.flower_img}')">
  <img src="${f.flower_img || ''}">
  
  <span>
    <span style="color:${getColor(type)}">
      ${f.flower_name}
    </span>
    <br>
    <small>${flowerCountMap[f.id] || 0} thành viên</small>
  </span>
</div>
      `).join("")}
    </div>
  </div>
`;
  }).join("");
}

function renderFlowerFiltered(list) {
  const box = document.getElementById("result");

  const order = ["Đỏ", "Cam", "Tím", "Lam", "Lục"];
  const grouped = {};

  list.forEach(f => {
    if (!grouped[f.flower_type]) grouped[f.flower_type] = [];
    grouped[f.flower_type].push(f);
  });

  Object.keys(grouped).forEach(type => {
    grouped[type].sort((a, b) =>
      a.flower_name.localeCompare(b.flower_name, "vi")
    );
  });

  box.innerHTML = order.map(type => {
    if (!grouped[type]) return "";

    return `
      <div class="group ${getGroupClass(type)}">
        <div class="group-title">${type} (${grouped[type].length})</div>

        <div class="grid">
          ${grouped[type].map(f => `
            <div class="grid-item" onclick="selectFlower('${f.id}','${f.flower_name}','${f.flower_img}')">
  <img src="${f.flower_img || ''}">
  
  <span>
    <span style="color:${getColor(type)}">
      ${highlight(f.flower_name)}
    </span>
    <br>
    <small>${flowerCountMap[f.id] || 0} thành viên</small>
  </span>
</div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderUserFiltered(list) {
  const box = document.getElementById("result");

  const sorted = [...list].sort((a, b) =>
    (b.flowers?.length || 0) - (a.flowers?.length || 0)
  );

  const groups = {
    "Kết quả": sorted
  };

  box.innerHTML = Object.keys(groups).map(type => {
    if (!groups[type].length) return "";

    return `
      <div class="group">
        <div class="group-title">${type} (${groups[type].length})</div>

        <div class="grid">
          ${groups[type].map(u => `
            <div class="grid-item" onclick="selectUser('${u.name}')">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random">

              <span>
                ${highlight(u.name)}
                <br>
                <small>${u.flowers?.length || 0} hoa</small>
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function highlight(text) {
  const raw = document.getElementById("searchInput").value.trim();
  if (!raw) return text;

  const keyword = normalize(raw);

  return text.replace(new RegExp(`(${raw})`, "gi"), `<mark>$1</mark>`);
}

/* COLOR THEO PHẨM */
function getColor(type) {
  return {
    "Đỏ": "#ef4444",
    "Cam": "#f59e0b",
    "Tím": "#a855f7",
    "Lam": "#3b82f6",
    "Lục": "#22c55e"
  }[type] || "#333";
}

function getGroupClass(type) {
  return {
    "Đỏ": "red",
    "Cam": "orange",
    "Tím": "purple",
    "Lam": "blue",
    "Lục": "green"
  }[type] || "";
}

/* RENDER USER GRID */
function renderUserGrid() {
  const box = document.getElementById("result");

  // sort theo số hoa
  const sorted = [...allUsers].sort((a, b) =>
    (b.flowers?.length || 0) - (a.flowers?.length || 0)
  );

  // chia nhóm (tuỳ chọn: top / thường)
  const groups = {
    "Top": sorted.filter(u => (u.flowers?.length || 0) >= 5),
    "Khác": sorted.filter(u => (u.flowers?.length || 0) < 5)
  };

  box.innerHTML = Object.keys(groups).map(type => {
    if (!groups[type].length) return "";

    return `
      <div class="group">
        <div class="group-title">${type} (${groups[type].length})</div>

        <div class="grid">
          ${groups[type].map(u => `
            <div class="grid-item" onclick="selectUser('${u.name}')">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&size=64">
              
              <span>
                ${u.name}
                <br>
                <small style="color:#666">
                  ${u.flowers?.length || 0} hoa
                </small>
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

window.onload = async () => {
  const { data: { user } } = await client.auth.getUser();

  if (user) {
    if (user.email === "bigdrgn818@gmail.com") {
      currentRole = "admin";
    }

    renderAdmin();

    // 🔥 ẩn search luôn
    document.querySelector(".search-wrapper").style.display = "none";

    return;
  }
  const { data: flowers } = await client.from("flowers").select("*");
  allFlowers = flowers || [];

  const { data: users } = await client.from("users").select("*");
  allUsers = users || [];

  buildFlowerCount(); // 🔥 phải trước

  tabs.forEach(t => t.classList.remove("active"));
  document.querySelector(".nav-item").classList.add("active");

  renderFlowerGrid(); // 🔥 gọi sau cùng
};

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

let debounceTimer;

function handleSearch() {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    runSearch();
  }, 200); // 🔥 200ms là mượt nhất
}

function runSearch() {
  const keyword = normalize(document.getElementById("searchInput").value.trim());
  const activeTab = document.querySelector(".nav-item.active").innerText;

  if (!keyword) {
    if (activeTab.includes("HOA")) renderFlowerGrid();
    else renderUserGrid();
    return;
  }

  // HOA
  if (activeTab.includes("HOA")) {
    const filtered = allFlowers.filter(f =>
      normalize(f.flower_name).includes(keyword)
    );

    renderFlowerFiltered(filtered);
  }

  // USER
  if (activeTab.includes("THÀNH")) {
    const filtered = allUsers.filter(u =>
      normalize(u.name).includes(keyword)
    );

    renderUserFiltered(filtered);
  }
}

function countUsersByFlower(flowerId) {
  return allUsers.filter(u =>
    (u.flowers || []).includes(String(flowerId))
  ).length;
}

let flowerCountMap = {};

function buildFlowerCount() {
  flowerCountMap = {};

  allUsers.forEach(u => {
    (u.flowers || []).forEach(fid => {
      flowerCountMap[fid] = (flowerCountMap[fid] || 0) + 1;
    });
  });
}

//ADMIN
function renderAdmin() {
  const box = document.getElementById("result");

  box.innerHTML = `
    <div class="group">

      <div class="group-header">
        <div class="group-title">Thêm hoa</div>
        <i class="edit-btn" onclick="logout()">[Đăng xuất]</i>
      </div>

      <div class="admin-center">

        <div class="row">
          <input id="flowerName" placeholder="Tên hoa tươi">

          <select id="flowerType">
            <option value="">Chọn phẩm</option>
            <option value="Đỏ">Đỏ</option>
            <option value="Cam">Cam</option>
            <option value="Tím">Tím</option>
            <option value="Lam">Lam</option>
            <option value="Lục">Lục</option>
          </select>
        </div>

        <input type="file" id="flowerFile" accept="image/*">

        <button class="btn primary" onclick="addFlower()">Thêm</button>

      </div>
    </div>

    <div class="group">
      <div class="group-title">Thêm thành viên</div>

      <div class="admin-center">
        <input id="userName" placeholder="Tên thành viên">

        <button class="btn primary" onclick="addUser()">Thêm</button>
      </div>
    </div>
  `;
}

//THÊM HOA
async function addFlower() {
  const name = document.getElementById("flowerName").value.trim();
  const type = document.getElementById("flowerType").value;
  const file = document.getElementById("flowerFile").files[0];

  if (!name) return showToast("Chưa nhập tên hoa");
  // 🔥 thêm ở đây
  const { data: existing } = await client
    .from("flowers")
    .select("id")
    .ilike("flower_name", name)
    .limit(1);

  if (existing && existing.length > 0) {
    return showToast("Hoa đã tồn tại");
  }
  if (!type) return showToast("Chưa chọn phẩm");

  let imageUrl = "";

  // 🔥 nếu có file thì upload
  if (file) {
    const fileName = toFileName(name) + ".png";

    const { error: uploadError } = await client.storage
      .from("flowers") // 🔥 bucket mới
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      return showToast("Upload ảnh lỗi");
    }

    const { data } = client.storage
      .from("flowers")
      .getPublicUrl(fileName);

    imageUrl = data.publicUrl;
  }

  // 🔥 insert DB (có thể không có ảnh)
  await client.from("flowers").insert([
    {
      flower_name: name,
      flower_type: type,
      flower_img: imageUrl
    }
  ]);

  showToast("Đã thêm hoa");

  // reset
  document.getElementById("flowerName").value = "";
  document.getElementById("flowerType").value = "";
  document.getElementById("flowerFile").value = "";
}

//THÊM USER
async function addUser() {
  const name = document.getElementById("userName").value.trim();

  if (!name) return showToast("Chưa nhập tên");

  // 🔥 check trùng (không phân biệt hoa/thường)
  const { data: existing } = await client
    .from("users")
    .select("id")
    .ilike("name", name)
    .limit(1);

  if (existing && existing.length > 0) {
    return showToast("Tên đã tồn tại");
  }

  // 🔥 insert
  await client.from("users").insert([
    {
      name: name,
      flowers: []
    }
  ]);

  showToast("Đã thêm thành viên");

  // reset + reload
  document.getElementById("userName").value = "";
  renderUserGrid();
}

/*SỬA HOA USER
async function assignFlower() {
  const name = document.getElementById("assignUser").value;
  const flowerId = document.getElementById("assignFlower").value;

  const { data } = await client
    .from("users")
    .select("*")
    .eq("name", name)
    .single();

  if (!data) return showToast("Không tìm thấy thành viên");

  const updated = [...(data.flowers || []), String(flowerId)];

  await client
    .from("users")
    .update({ flowers: updated })
    .eq("id", data.id);

  showToast("Đã cập nhật hoa");
}*/

//CONVERT TÊN HOA SANG TÊN ẢNH
function toFileName(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

//EDIT USER
function startEditUser(name) {

  // 🔥 nếu là admin → cho vào luôn
  if (currentRole === "admin") {
    editingUser = allUsers.find(u => u.name === name);
    if (!editingUser) return;

    renderEditUser();
    return;
  }

  // 👤 khách → hỏi mật khẩu
  editingUser = name; // lưu tạm tên
  document.getElementById("pwModal").classList.add("show");
}

function confirmEdit() {
  const pw = document.getElementById("pwInput").value;

  if (pw !== EDIT_PASSWORD) {
    showToast("Sai mật khẩu");
    return;
  }

  canEdit = true;

  closePwModal();

  // 🔥 mở lại user đang chọn
  const user = allUsers.find(u => u.name === editingUser);
  if (!user) return;

  editingUser = user;
  renderEditUser();
}

function closePwModal() {
  document.getElementById("pwModal").classList.remove("show");
  document.getElementById("pwInput").value = "";
}

//EDIT HOA USER
function renderEditUser() {
  const box = document.getElementById("result");

  const selected = editingUser.flowers || [];

  box.innerHTML = `
    <div class="group">
      <div class="group-header">
  <div class="group-title">
    ${editingUser.name} (<span id="count">${selected.length}</span> hoa)
  </div>

  <i class="edit-btn" onclick="updateUserFlowers()">
    [Xác nhận]
  </i>
</div>

      <div class="grid">
        ${sortFlowers().map(f => {
    const checked = selected.includes(String(f.id));

    return `
            <div class="grid-item ${checked ? 'active' : ''}" 
                 onclick="toggleFlower('${f.id}')">
              <img src="${f.flower_img || ''}">
              
              <span>
                <span style="color:${getColor(f.flower_type)}">
                  ${f.flower_name}
                </span>
              </span>
            </div>
          `;
  }).join("")}
      </div>
    </div>
  `;
}

//TOGGLE CHỌN HOA
function toggleFlower(id) {
  const list = editingUser.flowers || [];

  if (list.includes(String(id))) {
    editingUser.flowers = list.filter(f => f !== String(id));
  } else {
    editingUser.flowers = [...list, String(id)];
  }

  // update số lượng realtime
  document.getElementById("count").innerText = editingUser.flowers.length;

  renderEditUser(); // refresh UI
}

//UPDATE DB
async function updateUserFlowers() {
  await client
    .from("users")
    .update({ flowers: editingUser.flowers })
    .eq("id", editingUser.id);

  showToast("Đã cập nhật hoa");

  canEdit = false; // 🔒 khóa lại

  const { data } = await client.from("users").select("*");
  allUsers = data || [];

  buildFlowerCount(); // nếu chưa có thì thêm
  selectUser(editingUser.name);
}

//THÔNG BÁO
function showToast(msg) {
  const toast = document.getElementById("toast");

  toast.innerText = msg;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.classList.add("hidden");
    }, 300);
  }, 2000);
}

/*login 
async function login(email, password) {
  const { error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showToast("Sai tài khoản", "error");
  } else {
    showToast("Đăng nhập thành công", "success");
  }
}*/

async function handleLogin() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showToast("Sai tài khoản");
    closeLoginModal();
    renderFlowerGrid();
    return;
  }

  // 🔥 set role theo email
  if (data.user.email === "bigdrgn818@gmail.com") {
    currentRole = "admin";
  } else if (data.user.email === "mod@ht.com") {
    currentRole = "mod";
  } else {
    currentRole = "guest";
  }

  showToast("Đăng nhập thành công");
  closeLoginModal();

  // admin vào admin, mod thì về tab user
  if (currentRole === "admin") renderAdmin();
  else renderUserGrid();
}

async function openLoginModal() {
  const { data } = await client.auth.getUser();

  if (data?.user) {
    renderAdmin();
    return;
  }

  document.getElementById("loginModal").classList.add("show");

  setTimeout(() => {
    document.getElementById("loginEmail")?.focus();
  }, 100);
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");

  modal.classList.remove("show");

  tabs.forEach(t => t.classList.remove("active"));
  document.querySelector(".nav-item").classList.add("active");

  renderFlowerGrid();
}

async function logout() {

  await client.auth.signOut();
  currentRole = "guest";
  showToast("Đã đăng xuất");

  // reset UI
  tabs.forEach(t => t.classList.remove("active"));
  document.querySelector(".nav-item").classList.add("active");

  renderFlowerGrid();
}