export const CollectionAlgorithm = {
    RANDOM: 'random',           // Current random distribution
    RIDGE_DETECT: 'ridge',      // Ridge detection
    EDGE_FOLLOW: 'edge',        // Edge following
    CONTOUR: 'contour'         // Follow elevation contours
};

export const AlgorithmDescription = {
    [CollectionAlgorithm.RANDOM]: 'Randomly distributed points',
    [CollectionAlgorithm.RIDGE_DETECT]: 'Concentrated points along mountain ridges',
    [CollectionAlgorithm.EDGE_FOLLOW]: 'Points following terrain edges',
    [CollectionAlgorithm.CONTOUR]: 'Points following elevation contours'
}; 