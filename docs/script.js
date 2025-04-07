const generateButton = document.getElementById('generateButton');
const audioPlayer = document.getElementById('audioPlayer');
const localStorageKey = 'generatedNoise';
const buttonContainer = document.getElementById('buttonContainer');

// Show the loading spinner
function showLoading() {
    buttonContainer.innerHTML = `
        <span class="icon-[svg-spinners--blocks-scale] text-3xl"></span>
    `;
}

// Hide the loading spinner and show the button
function showGenerateButton() {
    buttonContainer.innerHTML = `
        <button id="generateButton" class="btn btn-outline btn-success">Generate</button>
    `;
    document.getElementById('generateButton').addEventListener('click', generateNoise);
}

// Save the audio URL to local storage
function saveAudioToLocalStorage(url) {
    localStorage.setItem(localStorageKey, url);
}

// Load audio from local storage
function loadAudioFromLocalStorage() {
    showLoading();
    
    const storedUrl = localStorage.getItem(localStorageKey);
    if (storedUrl) {
        audioPlayer.src = storedUrl;
        audioPlayer.loop = true;
        
        // Add event listener to detect when audio is loaded
        audioPlayer.oncanplaythrough = () => {
            // Change to the "ready" spinner when audio is loaded and playing
            buttonContainer.innerHTML = `
                <span class="icon-[svg-spinners--bars-scale-middle] text-2xl animate-flip-down"></span>
            `;
            audioPlayer.oncanplaythrough = null; // Remove event listener after first trigger
        };
        
        // Add error listener to handle cases where the stored URL is invalid
        audioPlayer.onerror = () => {
            console.warn('Stored audio URL is invalid or inaccessible');
            localStorage.removeItem(localStorageKey);
            showGenerateButton(); 
            audioPlayer.onerror = null; 
        };
        
        audioPlayer.play().catch(err => {
            console.warn('Autoplay blocked. User must interact first.', err);
        });
    } else {
        showGenerateButton();
    }
}

// Function to generate noise
async function generateNoise() {
    showLoading();

    const sampleRate = 44100;
    const freq1 = 110;
    const freq2 = 220;
    const freq3 = 440;
    const duration = 60 * 25; // 1 hour in seconds
    const numSamples = sampleRate * duration;

    const randNoise = Array.from({ length: sampleRate }, () => Math.random());

    function fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function grad(p) {
        const index = Math.floor(p) % randNoise.length;
        return randNoise[index] > 0.5 ? 1.0 : -1.0;
    }

    function noise(p) {
        const p0 = Math.floor(p);
        const p1 = p0 + 1.0;
        const t = p - p0;
        const fadeT = fade(t);
        const g0 = grad(p0);
        const g1 = grad(p1);
        return (1.0 - fadeT) * g0 * (p - p0) + fadeT * g1 * (p - p1);
    }

    try {
        const audioData = new Float32Array(numSamples);
        
        // Process in chunks to avoid UI freezing
        const chunkSize = sampleRate; // Process 1 second at a time
        let i = 0;
        
        function processChunk() {
            const end = Math.min(i + chunkSize, numSamples);
            
            for (; i < end; i++) {
                const x1 = i / (sampleRate / freq1);
                const x2 = i / (sampleRate / freq2);
                const x3 = i / (sampleRate / freq3);

                const n1 = noise(x1);
                const n2 = noise(x2);
                const n3 = noise(x3);

                audioData[i] = 0.5 * n1 + 0.3 * n2 + 0.2 * n3;
            }
            
            if (i < numSamples) {
                // Continue processing in the next animation frame
                requestAnimationFrame(processChunk);
            } else {
                // All done, create and play the audio
                finishAudioGeneration(audioData, sampleRate);
            }
        }
        
        // Start processing
        processChunk();
        
    } catch (err) {
        console.error('Error generating noise:', err);
        showGenerateButton(); // Show button again if generation fails
    }
}

// Finish audio generation after all chunks are processed
async function finishAudioGeneration(audioData, sampleRate) {
    try {
        const wavBuffer = await createWav(audioData, sampleRate);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        audioPlayer.src = url;
        audioPlayer.loop = true;
        
        saveAudioToLocalStorage(url);
        
        // Change to the "ready" spinner as the audio is now loaded and playing
        buttonContainer.innerHTML = `
            <span class="icon-[svg-spinners--bars-scale-middle] text-2xl"></span>
        `;
        audioPlayer.play().catch(err => {
            console.warn('Playback failed:', err);
            showGenerateButton(); // Show button if play fails
        });
    } catch (err) {
        console.error('Error creating audio:', err);
        showGenerateButton(); // Show button if creation fails
    }
}

// Create the WAV file from audio data
async function createWav(audioData, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 32;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = audioData.length * (bitsPerSample / 8);
    const fileSize = 44 + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true); // 3 = IEEE float
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < audioData.length; i++) {
        view.setFloat32(44 + i * 4, audioData[i], true);
    }

    return buffer;
}

// Helper function to write a string into a DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Load audio from local storage when the site loads
window.addEventListener('load', loadAudioFromLocalStorage);