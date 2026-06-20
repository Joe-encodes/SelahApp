// Database configuration constants
const DATABASE_NAME = "SelahAIDatabase";
const DATABASE_VERSION = 1;
const STORE_SONGS = "songs";
const STORE_AUDIO = "audio";

/**
 * Initializes the IndexedDB database instance and sets up the object stores.
 * @returns {Promise<IDBDatabase>}
 */
export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB initialization error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Create songs store with autoincrementing ID
      if (!database.objectStoreNames.contains(STORE_SONGS)) {
        database.createObjectStore(STORE_SONGS, { keyPath: "id" });
      }
      
      // Create audio store to map song IDs to binary audio blobs (WAVs/MP3s)
      if (!database.objectStoreNames.contains(STORE_AUDIO)) {
        database.createObjectStore(STORE_AUDIO);
      }
    };
  });
}

/**
 * Persists a song object to the songs store.
 * @param {Object} song - The song metadata and structure
 * @returns {Promise<void>}
 */
export async function saveSong(song) {
  const database = await initializeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_SONGS, "readwrite");
    const store = transaction.objectStore(STORE_SONGS);
    
    // Set created_at timestamp if not present for time-limiting lock controls
    if (!song.created_at) {
      song.created_at = Date.now();
    }
    
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieves all saved songs from the songs store.
 * @returns {Promise<Array<Object>>}
 */
export async function getAllSongs() {
  const database = await initializeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_SONGS, "readonly");
    const store = transaction.objectStore(STORE_SONGS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Removes a song and its associated audio blobs from the store.
 * @param {string|number} songId - The unique ID of the song
 * @returns {Promise<void>}
 */
export async function deleteSong(songId) {
  const database = await initializeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_SONGS, STORE_AUDIO], "readwrite");
    
    transaction.objectStore(STORE_SONGS).delete(songId);
    transaction.objectStore(STORE_AUDIO).delete(songId);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Stores a binary audio Blob associated with a specific key.
 * @param {string} cacheKey - The key identifier (e.g. 'song_{id}_backing' or 'song_{id}_soprano')
 * @param {Blob} audioBlob - The binary audio file data
 * @returns {Promise<void>}
 */
export async function cacheAudioBlob(cacheKey, audioBlob) {
  const database = await initializeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_AUDIO, "readwrite");
    const store = transaction.objectStore(STORE_AUDIO);
    const request = store.put(audioBlob, cacheKey);
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieves a cached audio Blob.
 * @param {string} cacheKey - The key identifier
 * @returns {Promise<Blob|null>}
 */
export async function getCachedAudioBlob(cacheKey) {
  const database = await initializeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_AUDIO, "readonly");
    const store = transaction.objectStore(STORE_AUDIO);
    const request = store.get(cacheKey);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (event) => reject(event.target.error);
  });
}
