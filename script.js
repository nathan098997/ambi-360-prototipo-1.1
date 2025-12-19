// Configuração dos projetos com persistência em localStorage
const STORAGE_KEY = 'vj360_projects';
const DEFAULT_PROJECTS = {
    'projeto-demo': {
        password: '123456',
        image: 'https://pannellum.org/images/alma.jpg',
        title: 'Projeto Demo',
        createdAt: new Date().toISOString()
    },
    'casa-modelo': {
        password: 'casa2024',
        image: 'https://pannellum.org/images/cerro-toco-0.jpg',
        title: 'Casa Modelo',
        createdAt: new Date().toISOString()
    },
    'apartamento-luxo': {
        password: 'luxo789',
        image: 'https://pannellum.org/images/from-tree.jpg',
        title: 'Apartamento de Luxo',
        createdAt: new Date().toISOString()
    }
};

function loadProjects() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_PROJECTS };
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Falha ao carregar projetos do localStorage, usando padrão.', e);
        return { ...DEFAULT_PROJECTS };
    }
}

function saveProjects() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
        console.error('Falha ao salvar projetos.', e);
    }
}

let projects = loadProjects();

const ADMIN_PASSWORD = 'admin123';
let viewer = null;
let previewViewer = null;
let hotspots = [];
let addingHotspot = false;
let editingHotspot = null;
let currentParentId = null;
let previewClickBound = false;
let previewCurrentImage = null;
let previewRootImage = null;
let editingProjectName = null;
let isAdminViewing = false;

// Toggle entre modo usuário e admin
document.getElementById('modeToggle').addEventListener('change', function() {
    if (this.checked) {
        showAdminMode();
    } else {
        showUserMode();
    }
});

// Login usuário
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const projectNameRaw = document.getElementById('projectName').value.trim();
    const projectName = slugify(projectNameRaw);
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    
    if (projects[projectName] && projects[projectName].password === password) {
        errorDiv.classList.add('hidden');
        isAdminViewing = false;
        showViewer(projectName);
    } else {
        errorDiv.textContent = 'Nome do projeto ou senha incorretos!';
        errorDiv.classList.remove('hidden');
    }
});

// Login admin
document.getElementById('adminForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('errorMessage');
    
    if (password === ADMIN_PASSWORD) {
        errorDiv.classList.add('hidden');
        showAdminPanel();
    } else {
        errorDiv.textContent = 'Senha de admin incorreta!';
        errorDiv.classList.remove('hidden');
    }
});

// Preview da logo
document.getElementById('logoUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('logoPreview');
    const uploadText = document.getElementById('logoUploadText');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Logo preview">
                <div class="logo-preview-text">Logo selecionada: ${file.name}</div>
                <button type="button" class="remove-logo" onclick="removeLogo()">Remover Logo</button>
            `;
            preview.classList.remove('hidden');
            uploadText.innerHTML = '✅ Logo selecionada';
        };
        reader.readAsDataURL(file);
    }
});

// Preview da imagem
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        hideImagePreview();
    }
});

// Controles de hotspot
document.getElementById('addHotspotBtn').addEventListener('click', function() {
    setAddHotspotMode(true);
});

document.getElementById('removeHotspotBtn').addEventListener('click', function() {
    hotspots = [];
    updateHotspotsList();
    if (previewViewer) {
        previewViewer.removeAllHotSpots();
    }
});

// Criar novo projeto
document.getElementById('createProjectForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nameRaw = document.getElementById('newProjectName').value.trim();
    const name = slugify(nameRaw);
    const password = document.getElementById('newProjectPassword').value;
    const title = document.getElementById('newProjectTitle').value.trim();
    const imageFile = document.getElementById('imageUpload').files[0];
    const logoFile = document.getElementById('logoUpload').files[0];

    if (!name) {
        toast('Informe um nome de projeto.', 'warn');
        return;
    }
    if (!title) {
        toast('Informe um título.', 'warn');
        return;
    }
    
    // Se estamos editando e não há nova imagem, usar a existente
    if (editingProjectName && !imageFile) {
        const existingProject = projects[editingProjectName];
        if (existingProject) {
            // Remover projeto antigo se o nome mudou
            if (editingProjectName !== name) {
                delete projects[editingProjectName];
            }
            
            let logoData = existingProject.logo || null;
            if (logoFile) {
                const logoReader = new FileReader();
                logoReader.onload = function(e) {
                    logoData = e.target.result;
                    projects[name] = {
                        password: password,
                        image: existingProject.image,
                        title: title,
                        hotspots: [...hotspots],
                        logo: logoData,
                        createdAt: existingProject.createdAt
                    };
                    saveProjects();
                    toast('Projeto atualizado com sucesso!', 'ok');
                    resetCreateForm();
                    showSection('projects');
                    updateProjectsGrid();
                };
                logoReader.readAsDataURL(logoFile);
                return;
            }
            
            projects[name] = {
                password: password,
                image: existingProject.image,
                title: title,
                hotspots: [...hotspots],
                logo: logoData,
                createdAt: existingProject.createdAt
            };
            saveProjects();
            
            toast('Projeto atualizado com sucesso!', 'ok');
            resetCreateForm();
            showSection('projects');
            updateProjectsGrid();
            return;
        }
    }
    
    if (!imageFile && !editingProjectName) {
        toast('Selecione uma imagem 360°.', 'warn');
        return;
    }
    if (projects[name] && !editingProjectName) {
        toast('Projeto já existe!', 'danger');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Remover projeto antigo se estamos editando e o nome mudou
        if (editingProjectName && editingProjectName !== name) {
            delete projects[editingProjectName];
        }
        
        const existingProject = editingProjectName ? projects[editingProjectName] : null;
        
        const projectData = {
            password: password,
            image: e.target.result,
            title: title,
            hotspots: [...hotspots],
            createdAt: existingProject ? existingProject.createdAt : new Date().toISOString()
        };
        
        if (logoFile) {
            const logoReader = new FileReader();
            logoReader.onload = function(logoEvent) {
                projectData.logo = logoEvent.target.result;
                projects[name] = projectData;
                saveProjects();
                
                const message = editingProjectName ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!';
                toast(message, 'ok');
                resetCreateForm();
                showSection('projects');
                updateProjectsGrid();
            };
            logoReader.readAsDataURL(logoFile);
        } else {
            projectData.logo = null;
            projects[name] = projectData;
            saveProjects();
            
            const message = editingProjectName ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!';
            toast(message, 'ok');
            resetCreateForm();
            showSection('projects');
            updateProjectsGrid();
        }

    };
    reader.readAsDataURL(imageFile);
});

// Logout buttons
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('adminLogoutBtn').addEventListener('click', logout);

// Modo escuro
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    
    // Salvar preferência
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Atualizar botão
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        btn.setAttribute('aria-pressed', isDark);
    }
}

// Carregar tema salvo
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
    updateThemeButton();
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const isDark = document.body.classList.contains('dark');
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        btn.setAttribute('aria-pressed', isDark);
    }
}

// Carregar tema ao iniciar
setTimeout(() => {
    loadTheme();
}, 500);

let currentScene = 'main';
let projectHotspots = [];
let visitedScenes = new Set(['main']);
let sequentialMode = true;
let sceneHistory = ['main'];

function showViewer(projectName) {
    const project = projects[projectName];
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('viewerContainer').classList.remove('hidden');
    document.getElementById('projectTitle').textContent = project.title;
    
    // Exibir logo personalizada se existir
    const projectLogo = document.getElementById('projectLogo');
    if (project.logo) {
        projectLogo.src = project.logo;
        projectLogo.style.display = 'block';
    } else {
        projectLogo.style.display = 'none';
    }
    
    projectHotspots = project.hotspots || [];
    currentScene = 'main';
    visitedScenes = new Set(['main']);
    sceneHistory = ['main'];
    
    // Destruir viewer anterior
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }

    try {
        if (projectHotspots.length > 0) {
            const scenes = createScenesConfig(project.image, projectHotspots);
            viewer = pannellum.viewer('panorama', {
                default: {
                    firstScene: 'main',
                    autoLoad: true,
                    autoRotate: -2,
                    compass: true,
                    showZoomCtrl: true,
                    showFullscreenCtrl: true
                },
                scenes: scenes
            });
            
            viewer.on('scenechange', function(sceneId) {
                // Atualizar histórico de navegação
                if (sceneId !== sceneHistory[sceneHistory.length - 1]) {
                    sceneHistory.push(sceneId);
                }
                
                currentScene = sceneId;
                visitedScenes.add(sceneId);
                
                // Recriar cenas com hotspots atualizados
                if (sequentialMode) {
                    const newScenes = createScenesConfig(project.image, projectHotspots);
                    
                    // As cenas já são criadas corretamente com hotspots
                    
                    // Adicionar/atualizar cenas
                    Object.keys(newScenes).forEach(sId => {
                        if (sId !== sceneId) {
                            try {
                                viewer.addScene(sId, newScenes[sId]);
                            } catch (e) {
                                // Cena já existe, apenas atualizar
                            }
                        }
                    });
                }
                
                updateNavigation();
            });
        } else {
            viewer = pannellum.viewer('panorama', {
                type: 'equirectangular',
                panorama: project.image,
                autoLoad: true,
                autoRotate: -2,
                compass: true,
                showZoomCtrl: true,
                showFullscreenCtrl: true
            });
        }
        
        viewer.on('load', function() {
            updateNavigation();
        });
        
    } catch (e) {
        console.error('Erro ao iniciar viewer:', e);
        toast('Não foi possível carregar o panorama.', 'danger');
    }
}

function createScenesConfig(mainImage, hotspotsArray) {
    const scenes = { main: { type: 'equirectangular', panorama: mainImage, hotSpots: [] } };
    const mainHotspots = (hotspotsArray || []).filter(h => !h.parentId);
    
    // Na cena principal, sempre mostrar apenas o primeiro hotspot
    if (mainHotspots.length > 0) {
        const firstHotspot = mainHotspots[0];
        const hotspotConfig = {
            id: firstHotspot.id,
            pitch: firstHotspot.pitch,
            yaw: firstHotspot.yaw,
            type: 'scene',
            text: firstHotspot.text,
            sceneId: 'scene_' + firstHotspot.id,
            cssClass: firstHotspot.type === 'door' ? 'hotspot-door' : 'hotspot-nav'
        };
        scenes.main.hotSpots.push(hotspotConfig);
    }
    
    // Criar cenas individuais para cada hotspot
    mainHotspots.forEach((h, index) => {
        if (h.targetImage) {
            const sceneId = 'scene_' + h.id;
            const hotSpots = [];
            
            // Botão voltar
            const prevScene = index > 0 ? 'scene_' + mainHotspots[index - 1].id : 'main';
            hotSpots.push({
                id: `back_${sceneId}`,
                pitch: -10,
                yaw: 180,
                type: 'scene',
                text: 'Voltar',
                sceneId: prevScene,
                cssClass: 'hotspot-back'
            });
            
            // Adicionar hotspots filhos desta cena
            const childHotspots = (hotspotsArray || []).filter(child => child.parentId === h.id);
            childHotspots.forEach(child => {
                if (child.targetImage) {
                    hotSpots.push({
                        id: child.id,
                        pitch: child.pitch,
                        yaw: child.yaw,
                        type: 'scene',
                        text: child.text,
                        sceneId: 'scene_' + child.id,
                        cssClass: child.type === 'door' ? 'hotspot-door' : 'hotspot-nav'
                    });
                }
            });
            
            // Próximo ponto (se existir e estiver disponível)
            if (index < mainHotspots.length - 1) {
                const nextHotspot = mainHotspots[index + 1];
                if (nextHotspot.targetImage) {
                    hotSpots.push({
                        id: `next_${sceneId}`,
                        pitch: nextHotspot.pitch,
                        yaw: nextHotspot.yaw,
                        type: 'scene',
                        text: nextHotspot.text,
                        sceneId: 'scene_' + nextHotspot.id,
                        cssClass: nextHotspot.type === 'door' ? 'hotspot-door' : 'hotspot-nav'
                    });
                }
            }
            
            scenes[sceneId] = {
                type: 'equirectangular',
                panorama: h.targetImage,
                hotSpots: hotSpots
            };
        }
        
        // Criar cenas para hotspots filhos
        const childHotspots = (hotspotsArray || []).filter(child => child.parentId === h.id);
        childHotspots.forEach(child => {
            if (child.targetImage) {
                const childSceneId = 'scene_' + child.id;
                scenes[childSceneId] = {
                    type: 'equirectangular',
                    panorama: child.targetImage,
                    hotSpots: [{
                        id: `back_${childSceneId}`,
                        pitch: -10,
                        yaw: 180,
                        type: 'scene',
                        text: 'Voltar',
                        sceneId: 'scene_' + h.id,
                        cssClass: 'hotspot-back'
                    }]
                };
            }
        });
    });
    
    return scenes;
}

function updateNavigation() {
    const navRooms = document.getElementById('navRooms');
    if (!navRooms) return;
    
    navRooms.innerHTML = '';
    
    // Adicionar cena principal
    const mainBtn = document.createElement('button');
    mainBtn.className = `nav-room ${currentScene === 'main' ? 'active' : ''}`;
    mainBtn.textContent = 'Cena Principal';
    mainBtn.onclick = () => {
        if (viewer && currentScene !== 'main') {
            viewer.loadScene('main');
        }
    };
    navRooms.appendChild(mainBtn);
    
    // Mostrar pontos baseado na cena atual
    const mainHotspots = projectHotspots.filter(h => !h.parentId && h.targetImage);
    
    if (currentScene === 'main') {
        // Na cena principal, mostrar apenas o primeiro ponto
        if (mainHotspots.length > 0) {
            const hotspot = mainHotspots[0];
            const btn = document.createElement('button');
            btn.className = 'nav-room next-available';
            btn.textContent = hotspot.text;
            btn.onclick = () => {
                if (viewer) {
                    viewer.loadScene('scene_' + hotspot.id);
                }
            };
            navRooms.appendChild(btn);
        }
    } else {
        // Em outras cenas, mostrar pontos visitados + próximo
        const currentIndex = mainHotspots.findIndex(h => 'scene_' + h.id === currentScene);
        
        // Se estamos em uma cena filha, encontrar o pai
        let parentHotspot = null;
        if (currentIndex === -1) {
            const currentHotspotId = currentScene.replace('scene_', '');
            const currentHotspot = projectHotspots.find(h => h.id === currentHotspotId);
            if (currentHotspot && currentHotspot.parentId) {
                parentHotspot = projectHotspots.find(h => h.id === currentHotspot.parentId);
            }
        }
        
        mainHotspots.forEach((hotspot, index) => {
            const sceneId = 'scene_' + hotspot.id;
            const isCurrentScene = currentScene === sceneId;
            const isParentScene = parentHotspot && parentHotspot.id === hotspot.id;
            const shouldShow = index <= currentIndex + 1 || isParentScene;
            
            if (shouldShow) {
                const btn = document.createElement('button');
                btn.className = `nav-room ${isCurrentScene || isParentScene ? 'active' : ''} ${index === currentIndex + 1 ? 'next-available' : ''}`;
                btn.textContent = hotspot.text;
                btn.onclick = () => {
                    if (viewer && currentScene !== sceneId) {
                        viewer.loadScene(sceneId);
                    }
                };
                navRooms.appendChild(btn);
            }
        });
        
        // Mostrar hotspots filhos da cena atual
        if (currentIndex >= 0) {
            const currentMainHotspot = mainHotspots[currentIndex];
            const childHotspots = projectHotspots.filter(h => h.parentId === currentMainHotspot.id && h.targetImage);
            
            childHotspots.forEach(child => {
                const childSceneId = 'scene_' + child.id;
                const isCurrentChildScene = currentScene === childSceneId;
                
                const btn = document.createElement('button');
                btn.className = `nav-room ${isCurrentChildScene ? 'active' : 'next-available'}`;
                btn.textContent = child.text;
                btn.onclick = () => {
                    if (viewer && currentScene !== childSceneId) {
                        viewer.loadScene(childSceneId);
                    }
                };
                navRooms.appendChild(btn);
            });
        }
    }
}

function showUserMode() {
    document.getElementById('userLogin').classList.remove('hidden');
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
}

function showAdminMode() {
    document.getElementById('userLogin').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    showSection('projects');
    updateProjectsGrid();
}

function showSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all sections
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('createSection').classList.add('hidden');
    
    if (section === 'projects') {
        document.getElementById('projectsSection').classList.remove('hidden');
        document.getElementById('pageTitle').textContent = 'Projetos';
        document.getElementById('pageSubtitle').textContent = 'Aqui você faz a gestão de seus projetos.';
        document.querySelectorAll('.nav-item')[0].classList.add('active');
        resetCreateForm();
    } else if (section === 'create') {
        document.getElementById('createSection').classList.remove('hidden');
        if (!editingProjectName) {
            document.getElementById('pageTitle').textContent = 'Criar Projeto';
            document.getElementById('pageSubtitle').textContent = 'Configure um novo projeto 360°.';
            document.getElementById('submitProjectBtn').textContent = 'Criar Projeto';
        }
        document.querySelectorAll('.nav-item')[1].classList.add('active');
    }
}

function removeLogo() {
    document.getElementById('logoUpload').value = '';
    document.getElementById('logoPreview').classList.add('hidden');
    document.getElementById('logoUploadText').innerHTML = '🖼️ Clique para selecionar uma logo';
}

function resetCreateForm() {
    editingProjectName = null;
    document.getElementById('createProjectForm').reset();
    hideImagePreview();
    removeLogo();
    hotspots = [];
    document.getElementById('pageTitle').textContent = 'Criar Projeto';
    document.getElementById('pageSubtitle').textContent = 'Configure um novo projeto 360°.';
    document.getElementById('submitProjectBtn').textContent = 'Criar Projeto';
}

function updateProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '';
    
    const projectEntries = Object.entries(projects);
    
    if (projectEntries.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    projectEntries.forEach(([name, project]) => {
        const createdDate = new Date(project.createdAt).toLocaleDateString('pt-BR');
        const hotspotCount = project.hotspots ? project.hotspots.length : 0;
        
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="project-thumbnail">
                <img src="${project.image}" alt="${project.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px 8px 0 0;">
            </div>
            <div class="project-info">
                <div class="project-name">${project.title}</div>
                <div class="project-meta">Tour Virtual 360° • ${createdDate} • ${hotspotCount} pontos</div>
                <div class="project-actions">
                    <button class="btn-sm btn-view" onclick="previewProject('${name}')">👁️ Ver</button>
                    <button class="btn-sm btn-edit" onclick="editProject('${name}')">✏️ Editar</button>
                    <button class="btn-sm btn-delete" onclick="deleteProject('${name}')">🗑️ Excluir</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function editProject(name) {
    const project = projects[name];
    if (!project) return;
    
    editingProjectName = name;
    
    // Preencher formulário com dados existentes
    document.getElementById('newProjectName').value = name;
    document.getElementById('newProjectPassword').value = project.password;
    document.getElementById('newProjectTitle').value = project.title;
    
    // Mostrar preview da logo existente
    if (project.logo) {
        const preview = document.getElementById('logoPreview');
        const uploadText = document.getElementById('logoUploadText');
        preview.innerHTML = `
            <img src="${project.logo}" alt="Logo preview">
            <div class="logo-preview-text">Logo atual do projeto</div>
            <button type="button" class="remove-logo" onclick="removeLogo()">Remover Logo</button>
        `;
        preview.classList.remove('hidden');
        uploadText.innerHTML = '✅ Logo carregada';
    }
    
    // Mostrar preview da imagem existente
    if (project.image) {
        showImagePreview(project.image);
        // Carregar hotspots existentes
        hotspots = project.hotspots ? [...project.hotspots] : [];
        setTimeout(() => {
            updateHotspotsList();
        }, 1000);
    }
    
    // Alterar título da seção
    document.getElementById('pageTitle').textContent = 'Editar Projeto';
    document.getElementById('pageSubtitle').textContent = 'Modifique as configurações do projeto.';
    document.getElementById('submitProjectBtn').textContent = 'Salvar Alterações';
    
    showSection('create');
}

function previewProject(name) {
    isAdminViewing = true;
    showViewer(name);
}

function deleteProject(name) {
    if (confirm(`Excluir projeto "${projects[name].title}"?`)) {
        delete projects[name];
        saveProjects();
        updateProjectsGrid();
        toast('Projeto excluído.', 'ok');
    }
}

function showImagePreview(imageSrc) {
    document.getElementById('imagePreview').classList.remove('hidden');
    currentParentId = null;
    previewClickBound = false;
    previewCurrentImage = imageSrc;
    previewRootImage = imageSrc;

    if (previewViewer) {
        previewViewer.destroy();
    }

    setTimeout(() => {
        previewViewer = pannellum.viewer('previewPanorama', {
            type: 'equirectangular',
            panorama: previewCurrentImage,
            autoLoad: true,
            showZoomCtrl: false,
            showFullscreenCtrl: false
        });
        
        previewViewer.on('load', function() {
            setupHotspotClick();
            updateHotspotsList();
        });
    }, 100);
}

function setupHotspotClick() {
    if (previewClickBound) return;
    
    const panoramaDiv = document.getElementById('previewPanorama');
    if (!panoramaDiv) return;
    
    const onClickPreview = (event) => {
        if (!addingHotspot) return;
        event.preventDefault();
        event.stopPropagation();
        
        let coords = null;
        try { 
            coords = previewViewer.mouseEventToCoords(event); 
        } catch (_) {}
        
        const pitch = coords ? coords[0] : previewViewer.getPitch();
        const yaw = coords ? coords[1] : previewViewer.getYaw();
        const hotspotId = 'hotspot_' + Date.now();
        
        const hotspot = {
            id: hotspotId,
            pitch: pitch,
            yaw: yaw,
            text: 'Ponto ' + (hotspots.length + 1),
            targetImage: '',
            parentId: currentParentId || null
        };
        
        hotspots.push(hotspot);
        addHotspotToViewer(hotspot);
        updateHotspotsList();
        setAddHotspotMode(false);
        toast('Ponto adicionado!', 'ok');
    };
    
    panoramaDiv.addEventListener('click', onClickPreview, true);
    previewClickBound = true;
}

function addHotspotToViewer(hotspot) {
    if (previewViewer) {
        const hotspotConfig = {
            id: hotspot.id,
            pitch: hotspot.pitch,
            yaw: hotspot.yaw,
            type: 'info',
            text: hotspot.text,
            cssClass: hotspot.type === 'door' ? 'hotspot-door' : 'hotspot-nav'
        };
        
        previewViewer.addHotSpot(hotspotConfig);
    }
}

function changeHotspotType(id, type) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot) {
        hotspot.type = type;
        
        // Atualizar no viewer
        if (previewViewer) {
            previewViewer.removeHotSpot(id);
            addHotspotToViewer(hotspot);
        }
        
        // Atualizar a lista
        updateHotspotsList();
        toast(`Tipo alterado para ${type === 'door' ? 'Porta' : 'Normal'}!`, 'ok');
    }
}

function hideImagePreview() {
    document.getElementById('imagePreview').classList.add('hidden');
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
    hotspots = [];
    addingHotspot = false;
}

function updateHotspotsList() {
    const list = document.getElementById('hotspotsList');
    list.innerHTML = '';

    const currentList = hotspots.filter(h => (h.parentId || null) === (currentParentId || null));

    // Botão voltar quando não estamos na cena principal
    if (currentParentId) {
        const backBtn = document.createElement('button');
        backBtn.textContent = '↩ Voltar';
        backBtn.className = 'hotspot-btn';
        backBtn.style.marginBottom = '8px';
        backBtn.onclick = () => {
            const parentHotspot = hotspots.find(h => h.id === currentParentId);
            const grandParentId = parentHotspot ? (parentHotspot.parentId || null) : null;
            currentParentId = grandParentId;
            if (grandParentId) {
                const gpHotspot = hotspots.find(h => h.id === grandParentId);
                if (gpHotspot && gpHotspot.targetImage) {
                    previewCurrentImage = gpHotspot.targetImage;
                    previewViewer.setPanorama(previewCurrentImage);
                }
            } else {
                previewCurrentImage = previewRootImage;
                showImagePreview(previewCurrentImage);
            }
            updateHotspotsList();
        };
        list.appendChild(backBtn);
    }

    if (currentList.length === 0) {
        const p = document.createElement('p');
        p.className = 'hotspot-empty muted';
        p.textContent = 'Nenhum ponto adicionado nesta cena';
        list.appendChild(p);
        return;
    }

    currentList.forEach((hotspot, index) => {
        const item = document.createElement('div');
        item.className = 'hotspot-item';
        
        const hotspotType = hotspot.type || 'normal';
        
        item.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">Ponto ${index + 1}</div>
            <input type="text" class="hotspot-input" placeholder="Nome do ponto" value="${hotspot.text}" onchange="updateHotspotText('${hotspot.id}', this.value)">
            
            <div class="hotspot-type-selector">
                <div class="title">Tipo do Ponto:</div>
                <div class="hotspot-type-options">
                    <div class="hotspot-type-option ${hotspotType === 'normal' ? 'selected' : ''}" onclick="changeHotspotType('${hotspot.id}', 'normal')">
                        <img src="normal 1.png" class="hotspot-type-icon" alt="Normal">
                        <div>Normal</div>
                    </div>
                    <div class="hotspot-type-option ${hotspotType === 'door' ? 'selected' : ''}" onclick="changeHotspotType('${hotspot.id}', 'door')">
                        <img src="porta 1.png" class="hotspot-type-icon" alt="Porta">
                        <div>Porta</div>
                    </div>
                </div>
            </div>
            
            <div class="hotspot-controls">
                <div class="title">Ajustar Posição:</div>
                <div class="hotspot-grid">
                    <div></div>
                    <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', 0, 5)">↑</button>
                    <div></div>
                </div>
                <div class="hotspot-grid-2">
                    <div></div>
                    <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', -5, 0)">←</button>
                    <button class="hotspot-btn center" onclick="centerHotspot('${hotspot.id}')">Centro</button>
                    <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', 5, 0)">→</button>
                    <div></div>
                </div>
                <div class="hotspot-grid-3">
                    <div></div>
                    <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', 0, -5)">↓</button>
                    <div></div>
                </div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 6px; text-align: center;">Pitch: ${hotspot.pitch.toFixed(1)}° | Yaw: ${hotspot.yaw.toFixed(1)}°</div>
            </div>
            <input type="file" class="hotspot-file" accept="image/*" onchange="updateHotspotImage('${hotspot.id}', this)">
            <small style="color: #6b7280; display: block; margin: 4px 0;">Selecione a imagem 360° para este ponto</small>
            <button class="${hotspot.targetImage ? 'hotspot-enter' : 'hotspot-action'}" onclick="${hotspot.targetImage ? `enterHotspot('${hotspot.id}')` : `testHotspot('${hotspot.id}')`}">
                ${hotspot.targetImage ? '🔍 Entrar no Ponto' : 'Testar Posição'}
            </button>
            <button class="hotspot-remove" onclick="removeHotspot('${hotspot.id}')">Remover</button>
        `;
        
        list.appendChild(item);
    });
}

function updateHotspotText(id, text) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot) {
        hotspot.text = text;
        if (previewViewer) {
            previewViewer.removeHotSpot(id);
            addHotspotToViewer(hotspot);
        }
    }
}

function moveHotspot(id, deltaYaw, deltaPitch) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && previewViewer) {
        hotspot.yaw = ((hotspot.yaw + deltaYaw) % 360 + 360) % 360;
        hotspot.pitch = Math.max(-90, Math.min(90, hotspot.pitch + deltaPitch));
        previewViewer.removeHotSpot(id);
        addHotspotToViewer(hotspot);
        updateHotspotsList();
    }
}

function centerHotspot(id) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && previewViewer) {
        hotspot.pitch = previewViewer.getPitch();
        hotspot.yaw = previewViewer.getYaw();
        previewViewer.removeHotSpot(id);
        addHotspotToViewer(hotspot);
        updateHotspotsList();
    }
}

function updateHotspotImage(id, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const hotspot = hotspots.find(h => h.id === id);
            if (hotspot) {
                hotspot.targetImage = e.target.result;
                updateHotspotsList();
                toast('Cena conectada! Você pode entrar e adicionar pontos dentro dela.', 'ok');
            }
        };
        reader.readAsDataURL(file);
    }
}

function enterHotspot(id) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && hotspot.targetImage && previewViewer) {
        currentParentId = hotspot.id;
        previewCurrentImage = hotspot.targetImage;
        showImagePreview(previewCurrentImage);
        updateHotspotsList();
    }
}

function testHotspot(id) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && previewViewer) {
        previewViewer.lookAt(hotspot.pitch, hotspot.yaw, 75, 1000);
    }
}

function removeHotspot(id) {
    hotspots = hotspots.filter(h => h.id !== id);
    if (previewViewer) {
        previewViewer.removeHotSpot(id);
    }
    updateHotspotsList();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function showHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.classList.remove('hidden');
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.classList.add('hidden');
}

// ===================== MODO ESCURO =====================
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        btn.setAttribute('aria-pressed', isDark);
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
    updateThemeButton();
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const isDark = document.body.classList.contains('dark');
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        btn.setAttribute('aria-pressed', isDark);
    }
}

function toggleNavigation() {
    if (isAdminViewing) {
        // Se admin está visualizando, voltar para projetos
        if (viewer) {
            viewer.destroy();
            viewer = null;
        }
        document.getElementById('viewerContainer').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        isAdminViewing = false;
    } else {
        // Se usuário comum, voltar para login
        logout();
    }
}

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function setAddHotspotMode(on) {
    const btn = document.getElementById('addHotspotBtn');
    addingHotspot = !!on;
    if (btn) {
        if (on) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-warning');
            btn.style.background = '#fbbf24';
            btn.textContent = 'Clique na imagem';
        } else {
            btn.classList.add('btn-secondary');
            btn.style.background = '';
            btn.textContent = 'Adicionar Ponto';
        }
    }
}

function toast(msg, type = 'ok') {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return alert(msg);
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 2500);
}

function getPreviousScene(currentSceneId) {
    const mainHotspots = projectHotspots.filter(h => !h.parentId && h.targetImage);
    const currentIndex = mainHotspots.findIndex(h => 'scene_' + h.id === currentSceneId);
    
    if (currentIndex > 0) {
        return 'scene_' + mainHotspots[currentIndex - 1].id;
    }
    return 'main';
}

function logout() {
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }
    
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
    
    document.getElementById('viewerContainer').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('adminForm').reset();
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('modeToggle').checked = false;
    resetCreateForm();
    showUserMode();
    isAdminViewing = false;
}