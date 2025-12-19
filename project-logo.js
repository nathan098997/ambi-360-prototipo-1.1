// Função para exibir a logo do projeto no visualizador
function displayProjectLogo(logoUrl) {
    const logoElement = document.getElementById('projectLogo');
    
    if (logoUrl && logoUrl.trim() !== '') {
        logoElement.src = logoUrl;
        logoElement.style.display = 'block';
        logoElement.onerror = function() {
            this.style.display = 'none';
        };
    } else {
        logoElement.style.display = 'none';
    }
}

// Exemplo de uso ao carregar um projeto
function loadProject(projectData) {
    // Carrega o título do projeto
    document.getElementById('projectTitle').textContent = projectData.name;
    
    // Carrega a logo do projeto
    displayProjectLogo(projectData.logo);
    
    // Resto da lógica de carregamento do projeto...
}