// --- CONFIGURATION: EDIT THESE VALUES ---
const GITHUB_USERNAME = 'TotallyNotHappey'; // e.g., 'octocat'
const GITHUB_REPOSITORY_NAME = 'HappeyTunes'; // e.g., 'my-music-repo'
const GITHUB_BRANCH = 'main'; // Change to 'master' if needed
// ----------------------------------------

const REPO_API_URL = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPOSITORY_NAME}/contents/`;
const REPO_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPOSITORY_NAME}/${GITHUB_BRANCH}/`;

const artistsContainer = document.getElementById('artists-container');

// Loading states for better UX
const LOADING_STATES = {
    INITIAL: 'loading music...',
    FETCHING: 'loading music...',
    NO_ARTISTS: 'error',
    ERROR: 'error'
};

// Audio file extensions to look for
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];
// Image file extensions for artist icons
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif'];

/**
 * Checks if a file has one of the specified extensions
 * @param {string} filename 
 * @param {string[]} extensions 
 * @returns {boolean}
 */
function hasExtension(filename, extensions) {
    return extensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Extracts the song title from filename (removes extension)
 * @param {string} filename 
 * @returns {string}
 */
function getSongTitle(filename) {
    return filename.replace(/\.[^/.]+$/, "").replace(/_/g, ' ').replace(/-/g, ' ');
}

/**
 * Gets artist name in a formatted way
 * @param {string} folderName 
 * @returns {string}
 */
function getFormattedArtistName(folderName) {
    return folderName.replace(/_/g, ' ').replace(/-/g, ' ');
}

/**
 * Fetches the contents of a specific artist folder
 * @param {string} artistName The name of the folder/artist
 * @returns {Promise<Object>} Artist data with songs and icon
 */
async function fetchArtistData(artistName) {
    try {
        const response = await fetch(`${REPO_API_URL}${encodeURIComponent(artistName)}`);
        
        if (response.status === 404) {
            console.warn(`Artist folder not found: ${artistName}`);
            return { songs: [], iconPath: null };
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${artistName}`);
        }
        
        const contents = await response.json();
        
        // Filter audio files
        const songs = contents
            .filter(item => item.type === 'file' && hasExtension(item.name, AUDIO_EXTENSIONS))
            .map(item => ({
                filename: item.name,
                path: `${REPO_RAW_URL}${encodeURIComponent(artistName)}/${encodeURIComponent(item.name)}`,
                title: getSongTitle(item.name)
            }))
            .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically
        
        // Find icon file
        const iconFile = contents.find(item => 
            item.type === 'file' && 
            hasExtension(item.name, IMAGE_EXTENSIONS) &&
            (item.name.toLowerCase().includes('icon') || 
             item.name.toLowerCase().includes('profile') ||
             item.name.toLowerCase() === 'image.png' ||
             item.name.toLowerCase() === 'image.jpg')
        );
        
        const iconPath = iconFile 
            ? `${REPO_RAW_URL}${encodeURIComponent(artistName)}/${encodeURIComponent(iconFile.name)}`
            : null;
        
        return {
            name: getFormattedArtistName(artistName),
            folderName: artistName,
            songs: songs,
            iconPath: iconPath,
            songCount: songs.length
        };
    } catch (error) {
        console.error(`Error fetching data for artist ${artistName}:`, error);
        return { 
            name: getFormattedArtistName(artistName),
            folderName: artistName,
            songs: [], 
            iconPath: null,
            songCount: 0
        };
    }
}

/**
 * Creates an artist card element
 * @param {Object} artistData 
 * @returns {HTMLElement}
 */
function createArtistCard(artistData) {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.dataset.artist = artistData.folderName;
    
    // Default icon if no image found
    const defaultIcon = `
        <div class="artist-icon default-icon">
            <span>${artistData.name.charAt(0).toUpperCase()}</span>
        </div>
    `;
    
    const iconHTML = artistData.iconPath 
        ? `<img src="${artistData.iconPath}" class="artist-icon" alt="${artistData.name}" onerror="this.style.display='none'; this.parentNode.innerHTML = \`${defaultIcon}\`;">`
        : defaultIcon;
    
    let songsHTML = '';
    
    if (artistData.songs.length > 0) {
        artistData.songs.forEach(song => {
            songsHTML += `
                <li>
                    <span class="song-title">${song.title}</span>
                    <span class="song-player">
                        <audio controls preload="none" data-title="${song.title}">
                            <source src="${song.path}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                    </span>
                </li>
            `;
        });
    } else {
        songsHTML = `<li class="no-songs">No songs found for this artist.</li>`;
    }
    
    card.innerHTML = `
        <div class="artist-header">
            ${iconHTML}
            <div class="artist-info">
                <div class="artist-name">${artistData.name}</div>
                <div class="song-count">${artistData.songCount} song${artistData.songCount !== 1 ? 's' : ''}</div>
            </div>
        </div>
        <ul class="song-list">${songsHTML}</ul>
    `;
    
    return card;
}

/**
 * Renders the full list of artists and their songs
 */
async function renderMusicList() {
    artistsContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>${LOADING_STATES.INITIAL}</p>
        </div>
    `;

    try {
        // Fetch the repository contents
        const response = await fetch(REPO_API_URL);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Repository not found. Please check your GitHub username and repository name.`);
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const repoContents = await response.json();
        
        // Filter for directories (artist folders)
        const artistFolders = repoContents
            .filter(item => item.type === 'dir')
            .map(item => item.name);
        
        if (artistFolders.length === 0) {
            artistsContainer.innerHTML = `<p class="info-message">${LOADING_STATES.NO_ARTISTS}</p>`;
            return;
        }
        
        artistsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading ${artistFolders.length} artists...</p>
            </div>
        `;
        
        // Process each artist folder
        const artistCards = [];
        const artistPromises = artistFolders.map(folderName => 
            fetchArtistData(folderName).then(data => createArtistCard(data))
        );
        
        // Wait for all artists to load
        const cards = await Promise.all(artistPromises);
        
        // Clear container and append cards
        artistsContainer.innerHTML = '';
        
        // Add artist count header
        const header = document.createElement('div');
        header.className = 'artists-header';
        header.innerHTML = `<h2>Artists (${cards.length})</h2>`;
        artistsContainer.appendChild(header);
        
        // Add each card
        cards.forEach(card => {
            artistsContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error("Failed to render music list:", error);
        
        let errorMessage = LOADING_STATES.ERROR;
        if (error.message.includes('Repository not found')) {
            errorMessage = `
                <h3>Repository Not Found</h3>
                <p>Could not find a: ${GITHUB_USERNAME}/${GITHUB_REPOSITORY_NAME}</p>
                <p>Please check:</p>
                <ul>
                    <li>Your GitHub username is correct</li>
                    <li>The repository name is correct</li>
                    <li>The repository is public</li>
                </ul>
            `;
        }
        
        artistsContainer.innerHTML = `
            <div class="error-message">
                ${errorMessage}
                <button onclick="renderMusicList()" class="retry-btn">Retry</button>
            </div>
        `;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', renderMusicList);

// Optional: Add CSS for loading states and enhancements
const style = document.createElement('style');
style.textContent = `
    .loading {
        text-align: center;
        padding: 40px;
    }
    
    .spinner {
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top: 3px solid #1DB954;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .artist-card .default-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        color: white;
    }
    
    .artist-info {
        display: flex;
        flex-direction: column;
    }
    
    .song-count {
        font-size: 0.9em;
        color: #aaa;
        margin-top: 5px;
    }
    
    .artists-header {
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #333;
    }
    
    .artists-header h2 {
        font-size: 1.8em;
    }
    
    .error-message {
        background: rgba(255, 50, 50, 0.1);
        border: 1px solid #ff5555;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
    }
    
    .retry-btn {
        background: #1DB954;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 15px;
        font-weight: bold;
    }
    
    .retry-btn:hover {
        background: #1ed760;
    }
    
    .info-message {
        text-align: center;
        padding: 40px;
        color: #aaa;
    }
    
    .no-songs {
        color: #aaa;
        font-style: italic;
    }
    
    /* Responsive audio player */
    audio {
        width: 100%;
        max-width: 250px;
    }
    
    @media (max-width: 768px) {
        .artist-header {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .artist-icon {
            margin-bottom: 10px;
        }
        
        audio {
            max-width: 200px;
        }
    }
    
    @media (max-width: 480px) {
        audio {
            max-width: 150px;
        }
        
        .song-list li {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .song-player {
            margin-top: 5px;
        }
    }
`;
document.head.appendChild(style);
