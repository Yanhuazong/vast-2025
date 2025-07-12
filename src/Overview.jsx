import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

// --- Fixed Genre Groups and Colors with more distinct hues ---
const GENRE_GROUPS = [
    {
        name: "Folk",
        hue: 40,
        baseColor: "#FFE35E", // darkest Folk
        genres: [
            "Acoustic Folk",
            "Avant-Garde Folk",
            "Celtic Folk",
            "Indie Folk",
            "Oceanus Folk",
            "Post-Apocalyptic Folk"
        ]
    },
    {
        name: "Rock",
        hue: 0,
        baseColor: "#F13D81", // darkest Rock
        genres: [
            "Alternative Rock",
            "Blues Rock",
            "Desert Rock",
            "Indie Rock",
            "Jazz Surf Rock",
            "Psychedelic Rock",
            "Southern Gothic Rock",
            "Space Rock"
        ]
    },
    {
        name: "Pop",
        hue: 210,
        baseColor: "#37B6FF", // darkest Pop
        genres: [
            "Indie Pop",
            "Dream Pop",
            "Synthpop"
        ]
    },
    {
        name: "Metal",
        hue: 280,
        baseColor: "#9445EC", // darkest Metal
        genres: [
            "Doom Metal",
            "Speed Metal",
            "Symphonic Metal"
        ]
    },
    {
        name: "Other",
        hue: 120,
        baseColor: "#55FFB5", // darkest Other
        genres: [
            "Americana",
            "Darkwave",
            "Emo/Pop Punk",
            "Lo-Fi Electronica",
            "Sea Shanties",
            "Synthwave"
        ]
    }
];

// Build genre lookup and flat genre list
const genreLookup = (() => {
    const lookup = {};
    GENRE_GROUPS.forEach((group, groupIdx) => {
        // Use d3.hsl to extract the hue from the baseColor
        let baseHue = group.hue;
        if (group.baseColor) {
            try {
                baseHue = d3.hsl(group.baseColor).h;
            } catch (e) {
                // fallback to group.hue if parsing fails
            }
        }
        // Sort genres alphabetically for lightness assignment
        const sortedGenres = [...group.genres].sort((a, b) => a.localeCompare(b));
        group.genres.forEach((genre) => {
            const sortedIdx = sortedGenres.indexOf(genre);
            // All genres use the HSL gradient for color
            const lightness = 90 - 8 * (sortedIdx / Math.max(1, group.genres.length - 1));
            const color = `hsl(${baseHue},100%,${lightness}%)`;
            lookup[genre] = {
                group: group.name,
                groupIdx,
                genreIdx: group.genres.indexOf(genre),
                color
            };
        });
    });
    return lookup;
})();
const FLAT_GENRES = GENRE_GROUPS.flatMap(g => g.genres);

// --- Role filter with link colors ---
const ARTIST_ROLES = [
    { label: "Composer", color: "#DF41FF" },
    { label: "Lyricist", color: "#FF5053" },
    { label: "Performer", color: "#FFB547" },
    { label: "Producer", color: "#50DAF1" }
];

// Map for quick lookup by role
const ROLE_COLOR_MAP = {
    composedBy: "#DF41FF",
    lyricsBy: "#FF5053",
    performedBy: "#FFB547",
    producedBy: "#50DAF1"
};

// Lightbox component
const Lightbox = ({ isOpen, onClose, url }) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                zIndex: 10000,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'stretch',
                padding: '20px'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    position: 'relative',
                    width: '40%',
                    height: '100%',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '15px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        fontSize: '18px',
                        cursor: 'pointer',
                        zIndex: 10001,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ×
                </button>
                <iframe
                    src={url}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none'
                    }}
                    title="Sailor Website"
                />
            </div>
        </div>
    );
};

const createTooltip = () => {
    let tooltip = d3.select('#d3-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body')
            .append('div')
            .attr('id', 'd3-tooltip')
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('background', 'rgba(30,30,30,0.95)')
            .style('color', '#fff')
            .style('padding', '6px 12px')
            .style('border-radius', '6px')
            .style('font-size', '14px')
            .style('z-index', 1000)
            .style('display', 'none');
    }
    return tooltip;
};

const labelBandHeightByYear = [
    { year: 1985, height: 5 },
    { year: 1990, height: 10 },
    { year: 2010, height: 50 },
    { year: 2015, height: 80 },
    { year: 2020, height: 130 },
    { year: 2021, height: 150 },
    { year: 2023, height: 150 },
    { year: 2028, height: 130 },
    { year: 2030, height: 90 },
    { year: 2033, height: 40 },
    { year: 2040, height: 10 }
];

// Debounce utility
function debounce(fn, delay) {
    let timer = null;
    function debounced(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    }
    debounced.cancel = () => { if (timer) clearTimeout(timer); };
    return debounced;
}

function Overview({ data }) {
    const [hoveredArtworkId, setHoveredArtworkId] = useState(null);

    // --- Artist search state ---
    const [artistSearch, setArtistSearch] = useState("");
    const [showArtistDropdown, setShowArtistDropdown] = useState(false);
    const searchInputRef = useRef();

    // --- Lightbox state ---
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState("");

    // Handle escape key to close lightbox
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isLightboxOpen) {
                setIsLightboxOpen(false);
            }
        };

        if (isLightboxOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isLightboxOpen]);

    // Collapsible filter state
    const [showGenreFilter, setShowGenreFilter] = useState(false);
    const [showInfluenceFilter, setShowInfluenceFilter] = useState(false);
    const [showArtistFilter, setShowArtistFilter] = useState(false);
    // --- Artist role filter state ---
    const [selectedRoles, setSelectedRoles] = useState(() => new Set(ARTIST_ROLES.map(r => r.label)));
    const allRolesSelected = selectedRoles.size === ARTIST_ROLES.length;
    const noneRolesSelected = selectedRoles.size === 0;
    const handleRoleSelectAll = () => {
        if (allRolesSelected) setSelectedRoles(new Set());
        else setSelectedRoles(new Set(ARTIST_ROLES.map(r => r.label)));
    };
    const handleRoleChange = (role) => {
        setSelectedRoles(prev => {
            const next = new Set(prev);
            if (next.has(role)) next.delete(role);
            else next.add(role);
            return next;
        });
    };
    const toggleRoleFilter = () => setShowArtistFilter(!showArtistFilter);
    // Only artworks for main chart
    const nodes = useMemo(() =>
        data.nodes.filter(
            node =>
                node["Node Type"] &&
                (node["Node Type"].toLowerCase() === 'song' || node["Node Type"].toLowerCase() === 'album')
        ), [data.nodes]
    );

    const years = useMemo(() => {
        const y = nodes.map(node => node.release_date).filter(Boolean);
        return Array.from(new Set(y)).sort((a, b) => a - b);
    }, [nodes]);

    const genres = useMemo(() => FLAT_GENRES, []);

    // For people and groups
    const people = useMemo(() =>
        data.nodes.filter(
            node => node["Node Type"] && node["Node Type"].toLowerCase() === "person"
        ), [data.nodes]
    );
    const groups = useMemo(() =>
        data.nodes.filter(
            node => node["Node Type"] && node["Node Type"].toLowerCase() === "musicalgroup"
        ), [data.nodes]
    );
    // For record labels
    const recordLabels = useMemo(() =>
        data.nodes.filter(
            node => node["Node Type"] && node["Node Type"].toLowerCase() === "recordlabel"
        ), [data.nodes]
    );
    const nodeById = useMemo(() => {
        const map = {};
        data.nodes.forEach(n => { map[n.id] = n; });
        return map;
    }, [data.nodes]);
    const ref = useRef();
    const [svgHeight, setSvgHeight] = useState(1000); // Default height
    const zoomTransformRef = useRef(d3.zoomIdentity);
    // Dynamically update height based on width
    useEffect(() => {
        function updateHeight() {
            if (ref.current) {
                const width = ref.current.clientWidth || ref.current.parentElement?.clientWidth || window.innerWidth;
                // Use a ratio or a function of width for height
                const height = Math.max(600, Math.round(width * 1.33));
                setSvgHeight(height);
            }
        }
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // --- Main genre filter ---
    const [selectedGenres, setSelectedGenres] = useState(() => new Set(genres));
    const allSelected = selectedGenres.size === genres.length;
    const noneSelected = selectedGenres.size === 0;
    const handleSelectAll = () => {
        if (allSelected) setSelectedGenres(new Set());
        else setSelectedGenres(new Set(genres));
    };
    const handleGenreChange = (genre) => {
        setSelectedGenres(prev => {
            const next = new Set(prev);
            if (next.has(genre)) next.delete(genre);
            else next.add(genre);
            return next;
        });
    };

    // --- Influence genre filter ---
    const [influenceGenres, setInfluenceGenres] = useState(() => new Set());
    const allInfluenceSelected = influenceGenres.size === genres.length;
    const noneInfluenceSelected = influenceGenres.size === 0;
    const handleInfluenceSelectAll = () => {
        if (allInfluenceSelected) setInfluenceGenres(new Set());
        else setInfluenceGenres(new Set(genres));
    };
    const handleInfluenceGenreChange = (genre) => {
        setInfluenceGenres(prev => {
            const next = new Set(prev);
            if (next.has(genre)) next.delete(genre);
            else next.add(genre);
            return next;
        });
    };

    // --- Artist and label selection state ---
    const [selectedArtistId, setSelectedArtistId] = useState(null);
    const [selectedLabelId, setSelectedLabelId] = useState(null);

    // --- Filter nodes by influence and artist/label selection ---
    const filteredNodes = useMemo(() => {
        let filtered = nodes.filter(n => selectedGenres.size === 0 || selectedGenres.has(n.genre));
        if (influenceGenres.size > 0) {
            const influenceGenreNodeIds = new Set(
                data.nodes.filter(n => influenceGenres.has(n.genre)).map(n => n.id)
            );
            filtered = filtered.filter(n =>
                Array.isArray(n.influencedBy) &&
                n.influencedBy.some(id => influenceGenreNodeIds.has(id))
            );
        }
        // If a record label is selected, show all its recorded/distributed artworks
        if (selectedLabelId) {
            const label = nodeById[selectedLabelId];
            if (label) {
                const recorded = Array.isArray(label.recordedArtwork) ? label.recordedArtwork : [];
                const distributed = Array.isArray(label.distributedArtwork) ? label.distributedArtwork : [];
                const labelSet = new Set([...recorded, ...distributed]);
                filtered = filtered.filter(n => labelSet.has(n.id));
            }
        } else if (selectedArtistId) {
            const artist = nodeById[selectedArtistId];
            if (artist && Array.isArray(artist.contributedTo)) {
                const contributedSet = new Set(artist.contributedTo);
                filtered = filtered.filter(n => contributedSet.has(n.id));
            }
        }
        return filtered;
    }, [nodes, selectedGenres, influenceGenres, data.nodes, selectedArtistId, selectedLabelId, nodeById]);

    // --- Filtered people/groups: only contributors to visible songs/albums ---
    const visibleSongAlbumIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
    const visiblePeople = useMemo(() =>
        people.filter(p =>
            Array.isArray(p.contributedTo) && p.contributedTo.some(id => visibleSongAlbumIds.has(id))
        ), [people, visibleSongAlbumIds]
    );
    const visibleGroups = useMemo(() =>
        groups.filter(g =>
            Array.isArray(g.contributedTo) && g.contributedTo.some(id => visibleSongAlbumIds.has(id))
        ), [groups, visibleSongAlbumIds]
    );
    // --- Filter artistNodes by selected roles ---
    const artistNodes = useMemo(() => [
        ...visiblePeople
            .filter(p => Array.isArray(p.roles) && p.roles.some(r => selectedRoles.has(r)))
            .map(p => ({ ...p, _type: 'person' })),
        ...visibleGroups
            .filter(g => Array.isArray(g.roles) && g.roles.some(r => selectedRoles.has(r)))
            .map(g => ({ ...g, _type: 'group' }))
    ], [visiblePeople, visibleGroups, selectedRoles]);

    // --- Artist search results ---
    const artistSearchResults = useMemo(() => {
        if (!artistSearch.trim()) return [];
        const q = artistSearch.trim().toLowerCase();
        return artistNodes.filter(a => (a.name || "").toLowerCase().includes(q));
    }, [artistSearch, artistNodes]);

    // --- Visible record labels: only those with visible artworks ---
    const visibleLabels = useMemo(() =>
        recordLabels.filter(l => {
            const recorded = Array.isArray(l.recordedArtwork) ? l.recordedArtwork : [];
            const distributed = Array.isArray(l.distributedArtwork) ? l.distributedArtwork : [];
            return recorded.concat(distributed).some(id => visibleSongAlbumIds.has(id));
        }), [recordLabels, visibleSongAlbumIds]
    );

    // Add state for selected artwork (song/album) to show links
    const [selectedArtworkId, setSelectedArtworkId] = useState(null);

    // Memoize arcYears and angleScale
    const arcYears = useMemo(() => years.map(String).sort((a, b) => Number(a) - Number(b)), [years]);
    const arcStart = -Math.PI / 4;
    const arcEnd = Math.PI / 4;
    const angleScale = useMemo(() =>
        d3.scalePoint()
            .domain(arcYears)
            .range([arcStart, arcEnd]),
        [arcYears]
    );

    // --- Memoize per-artist tail data for all artists ---
    // const artistTailData = useMemo(() => {
    //     const map = {};
    //     artistNodes.forEach(node => {
    //         const contributedTo = Array.isArray(node.contributedTo)
    //             ? node.contributedTo.filter(id => visibleSongAlbumIds.has(id))
    //             : [];
    //         if (!contributedTo.length) return;

    //         const artworkYears = contributedTo
    //             .map(id => {
    //                 const art = nodeById[id];
    //                 return art ? String(art.release_date) : null;
    //             })
    //             .filter(y => y !== null);
    //         const influenceYears = Array.isArray(node.influence)
    //             ? node.influence.map(inf => inf.year).filter(y => !!y)
    //             : [];
    //         const yearsSet = new Set([...artworkYears, ...influenceYears]);
    //         const yearsList = Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));

    //         let influenceByYear = {};
            
    //         let hasKnownInfluence = false;

    //         map[node.id] = { yearsList, influenceByYear, hasKnownInfluence };
    //     });
    //     return map;
    // }, [artistNodes, data.nodes, visibleSongAlbumIds, nodeById]);

    // Memoize the draw function
    const draw = useCallback(() => {
        if (!ref.current) return;
        d3.select(ref.current).selectAll('*').remove();
        const width = ref.current.clientWidth;
        if (!width || width < 100) return;
        const height = svgHeight;
        // Make radius dynamic and proportional to the SVG size
        const radius = Math.min(width, height) * 0.5; // 45% of the smaller dimension
        const arcAngle = Math.abs(arcEnd - arcStart);
        const centerX = width / 2;
        // Adjust arcMidY and centerY to keep arc visible and centered
        const arcMidY = height * 0.85; // Lowered to fit arc in view
        const centerY = arcMidY - radius * Math.cos(arcAngle / 2);
        const svg = d3.select(ref.current);

        svg.style('background', '#030007');
        // --- ZOOM LOGIC ---
        const arcYears = years.map(String);
        const angleScale = d3.scalePoint()
            .domain(arcYears)
            .range([arcStart, arcEnd]);

        let zoomTransform = zoomTransformRef.current || d3.zoomIdentity;
        // Use the stored zoom transform so zoom/pan is preserved
        let contributorIds = new Set();
        // let extraContributors = [];
        // if (selectedArtistId) {
        //     contributorIds.forEach(id => {
        //       if (!artistNodes.some(n => n.id === id)) {
        //         // Find the node in people or groups
        //         let node = people.find(p => p.id === id) || groups.find(g => g.id === id);
        //         if (node) extraContributors.push({ ...node, _type: node["Node Type"].toLowerCase() });
        //       }
        //     });
        //   }
        //   const allArtistNodes = [...artistNodes, ...extraContributors];

        let highlightSet = null;
if (hoveredArtworkId && nodeById[hoveredArtworkId]) {
    const hovered = nodeById[hoveredArtworkId];
    highlightSet = new Set([String(hoveredArtworkId)]);
    if (Array.isArray(hovered.influenced)) hovered.influenced.forEach(id => highlightSet.add(String(id)));
    if (Array.isArray(hovered.influencedBy)) hovered.influencedBy.forEach(id => highlightSet.add(String(id)));
}
        const g = svg.append('g')
            .attr('class', 'zoom-group')
            .attr('transform', zoomTransform);

        g.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height + 2000)
            .attr('fill', 'transparent')
            .lower()
            .on('click', () => {
                setSelectedArtistId(null);
                setSelectedLabelId(null);
                setSelectedArtworkId(null);
            });

        const minBarWidth = 0.5;
        const maxBarWidth = 2.0;
        const yearRange = Math.max(arcYears.length, 1);
        const barWidth = Math.max(minBarWidth, Math.min(maxBarWidth, 3 - (yearRange - 2) * 0.04));
        const barGap = 0.5;
        const groupOffset = 22;

        const tooltip = createTooltip();

        // --- Draw arc and ticks/labels (always)
        const arc = d3.arc()
            .innerRadius(radius - 10)
            .outerRadius(radius)
            .startAngle(arcStart)
            .endAngle(arcEnd);

        g.append('path')
            .attr('d', arc)
            .attr('fill', '#222')
            .attr('transform', `translate(${centerX},${centerY})`);

        // Responsive tick/label sizing
        const minFontSize = 4;
        const minTickLength = 8;
        let maxFontSize = 6;
        let maxTickLength = 20;
        if (width > 2000) {
            maxFontSize = 12;
            maxTickLength = 20;
        }else if (width > 1600) {
            maxFontSize = 10;
            maxTickLength = 20;
        }else if (width > 1200) {
            maxFontSize = 8;
            maxTickLength = 20;
        }
        const fontSize = Math.max(minFontSize, Math.min(maxFontSize, width / 80));
        const tickLength = Math.max(minTickLength, Math.min(maxTickLength, width / 50));
        const tickStartRadius = radius + groupOffset; // 2px past the group center, adjust as needed
        const shortTickLen = tickLength * 1.1;
        const longTickLen = tickLength * 1.7;

        arcYears.forEach(year => {
            const angle = angleScale(year) - Math.PI / 2;
            // Top of tick: at the bottom of the genre bars
            const tickTopX = centerX + Math.cos(angle) * tickStartRadius;
            const tickTopY = centerY + Math.sin(angle) * tickStartRadius;

            const isMajorTick = (parseInt(year) % 5 === 0);
            const tickLen = isMajorTick ? longTickLen : shortTickLen;

            // Bottom of tick: inward from the genre bars
            const tickBottomX = centerX + Math.cos(angle) * (tickStartRadius - tickLen);
            const tickBottomY = centerY + Math.sin(angle) * (tickStartRadius - tickLen);

            g.append('line')
                .attr('x1', tickTopX)
                .attr('y1', tickTopY)
                .attr('x2', tickBottomX)
                .attr('y2', tickBottomY)
                .attr('stroke', '#fff')
                .attr('stroke-width', isMajorTick ? 2.2 : 1.2);

            // Label only for major ticks, at the bottom (inner end) of the tick
            if (isMajorTick) {
                g.append('text')
                    .attr('x', tickBottomX)
                    .attr('y', tickBottomY + 8)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', fontSize)
                    .attr('alignment-baseline', 'middle')
                    .attr('fill', '#fff')
                    .text(year);
            }
        });

        // --- Store positions for artworks and artists for link drawing ---
        const artworkPositions = {};
        const artistPositions = {};

        // --- PIE CHARTS FOR EACH YEAR (only when influence filter is active) ---
        const pieMinRadius = 5;
        const pieMaxRadius = 18;
        if (influenceGenres.size === genres.length) {

            arcYears.forEach(year => {
                const yearData = filteredNodes.filter(d => String(d.release_date) === String(year));
                if (yearData.length === 0) return;

                const maxArtworksInYear = Math.max(...arcYears.map(y => filteredNodes.filter(d => String(d.release_date) === String(y)).length), 1);
                const pieRadius = pieMinRadius + (pieMaxRadius - pieMinRadius) * (yearData.length / maxArtworksInYear);

                const influenceCounts = {};
                genres.forEach(genre => { influenceCounts[genre] = 0; });
                yearData.forEach(d => {
                    if (Array.isArray(d.influencedBy)) {
                        d.influencedBy.forEach(infId => {
                            const infNode = nodeById[infId];
                            if (infNode && infNode.genre) {
                                influenceCounts[infNode.genre] = (influenceCounts[infNode.genre] || 0) + 1;
                            }
                        });
                    }
                });
                const pieData = Object.entries(influenceCounts)
                    .filter(([genre, count]) => count > 0)
                    .map(([genre, count]) => ({ genre, count }));

                const pie = d3.pie()
                    .value(d => d.count)
                    .sort(null);

                const arcGen = d3.arc()
                    .innerRadius(0)
                    .outerRadius(pieRadius);

                const angle = angleScale(year) - Math.PI / 2;
                const pieArcRadius = radius - 60;
                const pieX = centerX + Math.cos(angle) * pieArcRadius;
                const pieY = centerY + Math.sin(angle) * pieArcRadius;

                const pieGroup = g.append('g')
                    .attr('transform', `translate(${pieX},${pieY})`);

                pieGroup.selectAll('path')
                    .data(pie(pieData))
                    .enter()
                    .append('path')
                    .attr('d', arcGen)
                    .attr('fill', d => genreLookup[d.data.genre]?.color || '#ccc')
                    .attr('stroke', '#222')
                    .attr('stroke-width', 0.3)
                    .on('mousemove', (event, d) => {
                        tooltip
                            .style('display', 'block')
                            .html(`<b>${d.data.genre}</b><br/>Influenced: ${d.data.count}`)
                            .style('left', (event.pageX + 12) + 'px')
                            .style('top', (event.pageY - 24) + 'px');
                    })
                    .on('mouseleave', () => tooltip.style('display', 'none'));

            });
        }

        // --- Draw record labels in a separate arc band above artists ---
        const minLabelRadius = 2;
        const maxLabelRadius = 10;
        const labelBandCenter = radius + 650; // above artist band

        // Find max number of artworks for scaling
        const maxLabelArtworks = Math.max(
            1,
            ...visibleLabels.map(label => {
                const recorded = Array.isArray(label.recordedArtwork) ? label.recordedArtwork : [];
                const distributed = Array.isArray(label.distributedArtwork) ? label.distributedArtwork : [];
                return new Set([...recorded, ...distributed]).size;
            })
        );

        visibleLabels.forEach(label => {
            // Only show if it has at least one visible artwork
            const recorded = Array.isArray(label.recordedArtwork) ? label.recordedArtwork : [];
            const distributed = Array.isArray(label.distributedArtwork) ? label.distributedArtwork : [];
            const allArtworks = [...recorded, ...distributed];
            const visibleArtworks = Array.from(
            new Set(allArtworks.filter(id => visibleSongAlbumIds.has(id)))
            );                
            if (visibleArtworks.length === 0) return;

            // Position: use median year of artworks
            const artworks = visibleArtworks.map(id => nodeById[id]).filter(Boolean);
            const yearsArr = artworks.map(a => a.release_date).filter(Boolean).sort((a, b) => a - b);
            let medianYear = arcYears[0];
            if (yearsArr.length > 0) {
                const mid = Math.floor(yearsArr.length / 2);
                medianYear = yearsArr.length % 2 === 0
                    ? Math.round((Number(yearsArr[mid - 1]) + Number(yearsArr[mid])) / 2)
                    : Number(yearsArr[mid]);
            }
            const yearStr = String(medianYear);
            // Add deterministic jitter to angle to reduce overlap
            const baseAngle = arcYears.includes(yearStr) ? angleScale(yearStr) - Math.PI / 2 : angleScale(arcYears[0]) - Math.PI / 2;
            // Use deterministic jitter based on label ID
            const idString = String(label.id || '');
            const hash = idString.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const angleJitter = ((hash % 100) / 100 - 0.5) * 0.05; // Deterministic angle jitter
            const angle = baseAngle + angleJitter;
            let bandHeight = labelBandHeightByYear[0].height;
            for (let i = 1; i < labelBandHeightByYear.length; i++) {
                const prev = labelBandHeightByYear[i - 1];
                const next = labelBandHeightByYear[i];
                if (medianYear <= next.year) {
                    const t = (medianYear - prev.year) / (next.year - prev.year);
                    bandHeight = prev.height + t * (next.height - prev.height);
                    break;
                }
            }
            if (medianYear > labelBandHeightByYear[labelBandHeightByYear.length - 1].year) {
                bandHeight = labelBandHeightByYear[labelBandHeightByYear.length - 1].height;
            }
            const radiusJitter = ((hash % 1000) / 1000 - 0.5) * bandHeight; // Deterministic radius jitter
            const r = radius -180 + radiusJitter;

            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            // Size
            const totalArtworks = new Set([...recorded, ...distributed]).size;
            const labelRadius = minLabelRadius + (maxLabelArtworks > 1 ? (maxLabelRadius - minLabelRadius) * (totalArtworks - 1) / (maxLabelArtworks - 1) : 0);

            // Color and highlight
            const isSelected = selectedLabelId === label.id;
            const opacity = isSelected ? 1 : 0.7;
            const stroke = isSelected ? '#f80' : 'none';    

            // Store position for links
            artistPositions[label.id] = { x, y };

            // Draw label node
            g.append('ellipse')
                .attr('cx', x)
                .attr('cy', y)
                .attr('rx', labelRadius * 1)
                .attr('ry', labelRadius)
                .attr('fill', '#ffe0b2')
                .attr('stroke', stroke)
                .attr('opacity', opacity)
                .style('cursor', 'pointer')
                .on('mousemove', (event) => {
                    tooltip
                        .style('display', 'block')
                        .html(`<b>${label.name || label.id}</b><br/>Record Label<br/>Visible Artworks: ${visibleArtworks.length}<br/>Total Artworks: ${totalArtworks}`)
                        .style('left', (event.pageX + 12) + 'px')
                        .style('top', (event.pageY - 24) + 'px');
                })
                .on('mouseleave', () => tooltip.style('display', 'none'))
                .on('click', (event) => {
                    event.stopPropagation();
                    setSelectedLabelId(selectedLabelId === label.id ? null : label.id);
                    setSelectedArtistId(null);
                    setSelectedArtworkId(null);
                });
        });

        // Draw bars/dots only if there are filtered nodes
        arcYears.forEach(year => {
            const yearData = filteredNodes.filter(d => String(d.release_date) === String(year));
            const angle = angleScale(year) - Math.PI / 2;
            const arcBaseX = Math.cos(angle) * radius;
            const arcBaseY = Math.sin(angle) * radius;
            const tanX = -Math.sin(angle);
            const tanY = Math.cos(angle);
            const groupBaseX = centerX + arcBaseX + Math.cos(angle) * groupOffset;
            const groupBaseY = centerY + arcBaseY + Math.sin(angle) * groupOffset;

            const totalBarCount = genres.length;
            const barWidthPx = barWidth + barGap;
            const barSpan = (totalBarCount - 1) * barWidthPx;
            const x1 = groupBaseX + tanX * (-barSpan / 2)*0.95;
            const y1 = groupBaseY + tanY * (-barSpan / 2)*0.95;
            const x2 = groupBaseX + tanX * (barSpan / 2)*0.95;
            const y2 = groupBaseY + tanY * (barSpan / 2)*0.95;

            g.append('line')
                .attr('x1', x1)
                .attr('y1', y1)
                .attr('x2', x2)
                .attr('y2', y2)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5);

            let barIdx = 0;
            if (filteredNodes.length > 0) {
                GENRE_GROUPS.forEach((group, groupIdx) => {
                    group.genres.forEach((genre, genreIdx) => {
                        const offset = (barIdx - (genres.length - 1) / 2) * (barWidth + barGap);
                        const x = groupBaseX + tanX * offset;
                        const y = groupBaseY + tanY * offset;
                        const genreData = yearData.filter(d => d.genre === genre);

                        // Dot stacking logic
                        const dots = [
                            ...genreData.filter(d => d["Node Type"].toLowerCase() === 'song' && d.notable).map(d => ({
                                ...d,
                                r: 0.7,
                                color: genreLookup[genre]?.color || "#fff",
                                label: "Notable Song"
                            })),
                            ...genreData.filter(d => d["Node Type"].toLowerCase() === 'song' && !d.notable).map(d => ({
                                ...d,
                                r: 0.7,
                                color: genreLookup[genre]?.color || "#fff",
                                label: "Song"
                            })),
                            ...genreData.filter(d => d["Node Type"].toLowerCase() === 'album' && d.notable).map(d => ({
                                ...d,
                                r: 1.0,
                                color: genreLookup[genre]?.color || "#fff",
                                label: "Notable Album"
                            })),
                            ...genreData.filter(d => d["Node Type"].toLowerCase() === 'album' && !d.notable).map(d => ({
                                ...d,
                                r: 1.0,
                                color: genreLookup[genre]?.color || "#fff",
                                label: "Album"
                            })),
                        ];

                        const isHighlighted = selectedGenres.has(genre);
                        const opacity =
                            selectedGenres.size === 0
                                ? 0.2
                                : isHighlighted
                                    ? 1
                                    : 0.2;

                        const filterActivePart =
                            (selectedGenres.size < 10 && selectedGenres.size > 0) ||
                            (influenceGenres.size > 0 && selectedGenres.size < 10) ||
                            (influenceGenres.size < 3 && influenceGenres.size > 0) ||
                            selectedLabelId !== null;

                        const personFilterActive = selectedArtistId !== null;

                        let stackOffset = 2;
                        const barAngle = Math.atan2(y - centerY, x - centerX);

                        dots.forEach((dot, i) => {
                            const dotRadius = personFilterActive ? dot.r * 4 : filterActivePart ? dot.r * 3 : dot.r;
                            const r = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) + stackOffset + dotRadius;
                            const dotX = centerX + Math.cos(barAngle) * r;
                            const dotY = centerY + Math.sin(barAngle) * r;
artworkPositions[dot.id] = { x: dotX, y: dotY };
                            let dotOpacity = opacity; // your existing logic
if (highlightSet) {
    // Only highlight if this dot is related to the hovered artwork below the timeline
    if (!highlightSet.has(String(dot.id))) {
        dotOpacity = 0.1;
    } else {
        dotOpacity = 1.0;
    }
}

                            if (dot.label === "Notable Song" || dot.label === "Notable Album") {
                                g.append('circle')
                                    .attr('cx', dotX)
                                    .attr('cy', dotY)
                                    .attr('r', dotRadius)
                                    .attr('fill', dot.color)
                                    .attr('opacity', dotOpacity)
                                    .on('mousemove', (event) => {
                                        setHoveredArtworkId(dot.id);
                                        tooltip
                                            .style('display', 'block')
                                            .html(
                                                `<b style="color:${genreLookup[genre]?.color || "#fff"}">${genre}</b><br/>
                                                ${dot.label}: ${dot.name || ""}`
                                            )
                                            .style('left', (event.pageX + 12) + 'px')
                                            .style('top', (event.pageY - 24) + 'px');
                                    })
                                    .on('mouseleave', () =>{
                                        setHoveredArtworkId(null);
                                    tooltip.style('display', 'none')
                                    })
                                    .on('click', (event) => {
                                        event.stopPropagation();
                                        setSelectedArtworkId(dot.id === selectedArtworkId ? null : dot.id);
                                    });
                                g.append('circle')
                                    .attr('cx', dotX)
                                    .attr('cy', dotY)
                                    .attr('r', dotRadius * 0.45)
                                    .attr('fill', '#fff')
                                    .attr('opacity', dotOpacity)
                                    .style('pointer-events', 'none'); // Prevent this small circle from capturing mouse events
                            } else {
                                g.append('circle')
                                    .attr('cx', dotX)
                                    .attr('cy', dotY)
                                    .attr('r', dotRadius)
                                    .attr('fill', dot.color)
                                    .attr('opacity', dotOpacity)
                                    .on('mousemove', (event) => {
                                        setHoveredArtworkId(dot.id);
                                        tooltip
                                            .style('display', 'block')
                                            .html(
                                                `<b style="color:${genreLookup[genre]?.color || "#fff"}">${genre}</b><br/>
                                                ${dot.label}: ${dot.name || ""}`
                                            )
                                            .style('left', (event.pageX + 12) + 'px')
                                            .style('top', (event.pageY - 24) + 'px');
                                    })
                                    .on('mouseleave', () => {
                                        setHoveredArtworkId(null);
                                        tooltip.style('display', 'none')
                                    })
                                    .on('click', (event) => {
                                        event.stopPropagation();
                                        setSelectedArtworkId(dot.id === selectedArtworkId ? null : dot.id);
                                    });
                                g.append('circle')
                                    .attr('cx', dotX)
                                    .attr('cy', dotY)
                                    .attr('r', dotRadius * 0.45)
                                    .attr('fill', '#000')
                                    .attr('opacity', dotOpacity)
                                    .style('pointer-events', 'none');
                            }
                            stackOffset += dotRadius * 2 + 0.5;
                        });

                        barIdx++;
                    });
                });
            }
        });
        // Draw artists only if there are filtered nodes and artistNodes
        if (filteredNodes.length > 0 && artistNodes.length > 0) {
            // --- Compute min/max total artworks for all visible artists (for circle size) ---
            let minTotalArtworks = Infinity, maxTotalArtworks = -Infinity;
            artistNodes.forEach(node => {
                const total = Array.isArray(node.contributedTo) ? node.contributedTo.length : 0;
                if (total < minTotalArtworks) minTotalArtworks = total;
                if (total > maxTotalArtworks) maxTotalArtworks = total;
            });
            const minArtistRadius = 1;
            const maxArtistRadius = 7;
            // --- New log10 banded artist layout with angle by year and radial spread by artworks ---
            const minBand = radius + 300;
            const bandStep = 60;
            const bandWidth = 60;
            function getBandIdx(inf) {
                if (!inf || inf === 0) return 0;
                return 1 + Math.floor(Math.log10(inf));
            }
            // Map: bandIdx -> array of artists
            const bandMap = {};
            artistNodes.forEach(node => {
                const contributedTo = Array.isArray(node.contributedTo)
                    ? node.contributedTo.filter(id => visibleSongAlbumIds.has(id))
                    : [];
                if (!contributedTo.length) return;
                const influenceScore = typeof node.totalInfluence === 'number' ? node.totalInfluence : 0;
                const bandIdx = getBandIdx(influenceScore);
                if (!bandMap[bandIdx]) bandMap[bandIdx] = [];
                bandMap[bandIdx].push({ ...node, _contributedTo: contributedTo });
            });
            Object.entries(bandMap).forEach(([bandIdxStr, artistsInBand]) => {
                const bandIdx = Number(bandIdxStr);
                const bandInner = minBand + bandIdx * bandStep;
                const bandOuter = bandInner + bandWidth;
                // Find min/max number of artworks in this band
                let minArtworks = Infinity, maxArtworks = -Infinity;
                artistsInBand.forEach(a => {
                    const n = a._contributedTo.length;
                    if (n < minArtworks) minArtworks = n;
                    if (n > maxArtworks) maxArtworks = n;
                });
                // For each artist, compute angle by lastPublishedYear, radius by #artworks
                artistsInBand.forEach(node => {
                    const totalArtworks = node._contributedTo.length;
                    // Angle by lastPublishedYear
                    const lastYear = String(node.lastPublishedYear);
                    let artistAngle;
                    if (lastYear && arcYears.includes(lastYear)) {
                        artistAngle = angleScale(lastYear) - Math.PI / 2;
                    } else {
                        // fallback: average of their artworks' years
                        const allArtworks = node._contributedTo.map(id => nodeById[id]).filter(Boolean);
                        const angles = allArtworks.map(art => {
                            const year = art.release_date;
                            if (!year) return null;
                            if (!arcYears.includes(String(year))) return null;
                            return angleScale(String(year)) - Math.PI / 2;
                        }).filter(a => a !== null);
                        artistAngle = angles.length === 0 ? 0 : angles.reduce((a, b) => a + b, 0) / angles.length;
                    }
                    // Radial position by #artworks in band
                    let t = 0.5;
                    if (maxArtworks > minArtworks) {
                        t = (totalArtworks - minArtworks) / (maxArtworks - minArtworks);
                    }
                    const r = bandInner + t * (bandOuter - bandInner);
                    // Add a small deterministic jitter to avoid perfect overlap
                    const idString = String(node.id || '');
                    const hash = idString.split('').reduce((a, b) => {
                        a = ((a << 5) - a) + b.charCodeAt(0);
                        return a & a;
                    }, 0);
                    const angleJitter = ((hash % 100) / 100 - 0.5) * 0.08;
                    const rJitter = ((hash % 1000) / 1000 - 0.5) * 40;
                    const finalAngle = artistAngle + angleJitter;
                    const finalR = r + rJitter;
                    const x = centerX + Math.cos(finalAngle) * finalR;
                    const y = centerY + Math.sin(finalAngle) * finalR;
                    artistPositions[node.id] = { x, y };
                    // --- Draw artist node (circle size by total artworks) ---
                    const totalArtworksAll = Array.isArray(node.contributedTo) ? node.contributedTo.length : 0;
                    let tSize = 0.5;
                    if (maxTotalArtworks > minTotalArtworks) {
                        tSize = (totalArtworksAll - minTotalArtworks) / (maxTotalArtworks - minTotalArtworks);
                    }
                    const artistRadius = minArtistRadius + (maxArtistRadius - minArtistRadius) * tSize;
                    const aboveTimelineArtworkIds = new Set(filteredNodes.map(n => n.id));
                    const numArtworks = Array.isArray(node.contributedTo)
                                        ? node.contributedTo.filter(id => aboveTimelineArtworkIds.has(id)).length
                                        : 0;

                    let fillColor = '#fffde7';
                    let artistOpacity = 0.70;
                    // Highlight logic for selected artwork
                    if (selectedArtworkId) {
                        const artworkNode = nodeById[selectedArtworkId];
                        if (artworkNode) {
                            // Collect all roles this artist has on the selected artwork
                            const roles = [
                                { key: "performedBy", color: ROLE_COLOR_MAP.performedBy },
                                { key: "composedBy", color: ROLE_COLOR_MAP.composedBy },
                                { key: "producedBy", color: ROLE_COLOR_MAP.producedBy },
                                { key: "lyricsBy", color: ROLE_COLOR_MAP.lyricsBy }
                            ].filter(({ key }) =>
                                Array.isArray(artworkNode[key]) && artworkNode[key].includes(node.id)
                            );
                            if (roles.length === 1) {
                                fillColor = roles[0].color;
                                artistOpacity = 0.85;
                            } else {
                                artistOpacity = 0.3; // fade out non-contributors
                            }
                        }
                    }
                    // If an artist is selected, highlight all connected artists
                    else if (selectedArtistId && Array.isArray(node.contributedTo) && node.contributedTo.length > 0) {
                        // Get all artworks the selected artist contributed to
                        const selectedArtist = artistNodes.find(n => n.id === selectedArtistId);
                        const selectedArtworks = selectedArtist && Array.isArray(selectedArtist.contributedTo)
                            ? selectedArtist.contributedTo
                            : [];
                        // Gather all contributors to those artworks (including the selected artist)
                        let connectedLinkTypes = new Set();
                        let isConnected = false;
                        selectedArtworks.forEach(artworkId => {
                            const artworkNode = nodeById[artworkId];
                            if (artworkNode) {
                                [
                                    { key: "performedBy", color: ROLE_COLOR_MAP.performedBy },
                                    { key: "composedBy", color: ROLE_COLOR_MAP.composedBy },
                                    { key: "producedBy", color: ROLE_COLOR_MAP.producedBy },
                                    { key: "lyricsBy", color: ROLE_COLOR_MAP.lyricsBy }
                                ].forEach(({ key, color }) => {
                                    if (Array.isArray(artworkNode[key]) && artworkNode[key].includes(node.id)) {
                                        connectedLinkTypes.add(color);
                                        isConnected = true;
                                    }
                                });
                            }
                        });
                        // If this artist is the selected artist or is connected, color by link type
                        if ((selectedArtistId === node.id || isConnected) && connectedLinkTypes.size === 1) {
                            fillColor = Array.from(connectedLinkTypes)[0];
                        }
                        artistOpacity = 0.85;
                    }
                    const isSelected = selectedArtistId === node.id;
                    const opacity = isSelected ? 1 : artistOpacity;
                    const stroke = isSelected ? '#ff0' : 'none';
                    const strokeWidth = isSelected ? 2 : 0.7;
                    // --- Draw variable-width arc tail for selected artist ---
                    if (selectedArtistId === node.id && Array.isArray(node.contributedTo) && node.contributedTo.length > 1) {
                        // 1. Get all contributed years, sorted
                        const yearsContributed = node.contributedTo
                            .map(id => {
                                const art = nodeById[id];
                                return art ? Number(art.release_date) : null;
                            })
                            .filter(y => y !== null)
                            .sort((a, b) => a - b);
                        if (yearsContributed.length > 1) {
                            const firstYear = String(yearsContributed[0]);
                            const lastYear = String(yearsContributed[yearsContributed.length - 1]);
                            // Start and end angles
                            const startAngle = arcYears.includes(firstYear) ? angleScale(firstYear) - Math.PI / 2 : artistAngle;
                            // Use the actual angle to the jittered artist position
                            const actualEndAngle = Math.atan2(y - centerY, x - centerX);
                            let endAngle = actualEndAngle;
                            if (endAngle <= startAngle) endAngle += 2 * Math.PI;
                            // Start and end positions
                            let startRadius;
                            if (bandIdx === 0) {
                                // For band 0, start at the artist's radius (same as end)
                                startRadius = finalR;
                            } else {
                                // For other bands, start at the baseline
                                startRadius = minBand + rJitter;
                            }
                            // Apply the same jitter to the starting position to avoid "going up" effect
                            const startX = centerX + Math.cos(startAngle) * startRadius + 0;
                            const startY = centerY + Math.sin(startAngle) * startRadius + 0;
                            // Use the exact artist position for the tail end
                            const endX = x;
                            const endY = y;
                            // --- Use node.influence (array: [{year, score}, ...]) ---
                            const influenceArray = Array.isArray(node.influence) ? node.influence : [];
                            // Filter out non-numeric years and handle "Unknown" influence
                            const cleanInfluenceArray = [];
                            let unknownInfluence = 0;
                            influenceArray.forEach(inf => {
                                if (inf.year === "Unknown" || isNaN(Number(inf.year))) {
                                    unknownInfluence += inf.score || 0;
                                } else {
                                    cleanInfluenceArray.push(inf);
                                }
                            });
                            // Distribute unknown influence proportionally across active years
                            if (unknownInfluence > 0 && yearsContributed.length > 0) {
                                const avgInfluencePerYear = unknownInfluence / yearsContributed.length;
                                yearsContributed.forEach(year => {
                                    cleanInfluenceArray.push({
                                        year: String(year),
                                        score: avgInfluencePerYear
                                    });
                                });
                            }
                            // Build yearsList as sorted union of all artwork years and influence years
                            const influenceYears = cleanInfluenceArray.map(inf => String(inf.year));
                            const artworkYears = yearsContributed.map(y => String(y));
                            const yearsSet = new Set([...artworkYears, ...influenceYears]);
                            const yearsList = Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
                            // Build cumulative influence by year with interpolation for unknown years
                            let influenceByYear = {};
                            let cumulative = 0;
                            // First, build a map of year -> cumulative influence for known years
                            const knownYears = yearsList.filter(year => 
                                cleanInfluenceArray.some(inf => String(inf.year) === year)
                            );
                            let lastKnownIdx = -1;
                            let lastKnownValue = 0;
                            let nextKnownIdx = -1;
                            let nextKnownValue = 0;
                            // Precompute cumulative sums for known years
                            let runningSum = 0;
                            const cumulativeByKnownYear = {};
                            yearsList.forEach(year => {
                                const yearInfluences = cleanInfluenceArray.filter(inf => String(inf.year) === year);
                                if (yearInfluences.length > 0) {
                                    const yearScore = yearInfluences.reduce((sum, inf) => sum + (inf.score || 0), 0);
                                    runningSum += yearScore;
                                    cumulativeByKnownYear[year] = runningSum;
                                }
                            });
                            // Now fill influenceByYear with interpolation for unknown years
                            for (let i = 0; i < yearsList.length; ++i) {
                                const year = yearsList[i];
                                if (cumulativeByKnownYear[year] !== undefined) {
                                    cumulative = cumulativeByKnownYear[year];
                                    influenceByYear[year] = cumulative;
                                    lastKnownIdx = i;
                                    lastKnownValue = cumulative;
                                } else {
                                    // Find next known year
                                    if (nextKnownIdx <= i) {
                                        nextKnownIdx = -1;
                                        for (let j = i + 1; j < yearsList.length; ++j) {
                                            if (cumulativeByKnownYear[yearsList[j]] !== undefined) {
                                                nextKnownIdx = j;
                                                nextKnownValue = cumulativeByKnownYear[yearsList[j]];
                                                break;
                                            }
                                        }
                                    }
                                    if (lastKnownIdx === -1 && nextKnownIdx !== -1) {
                                        // Before first known: flat at next known value
                                        influenceByYear[year] = nextKnownValue;
                                    } else if (lastKnownIdx !== -1 && nextKnownIdx === -1) {
                                        // After last known: flat at last known value
                                        influenceByYear[year] = lastKnownValue;
                                    } else if (lastKnownIdx !== -1 && nextKnownIdx !== -1) {
                                        // Interpolate between last known and next known
                                        const t = (i - lastKnownIdx) / (nextKnownIdx - lastKnownIdx);
                                        influenceByYear[year] = lastKnownValue + t * (nextKnownValue - lastKnownValue);
                                    } else {
                                        // No known values at all
                                        influenceByYear[year] = 0;
                                    }
                                }
                            }
                            const influenceVals = Object.values(influenceByYear);
                            const minTailInf = Math.min(...influenceVals);
                            const maxTailInf = Math.max(...influenceVals);
                            // For each year, calculate the tail radius (distance from center)
                            const tailMin = Math.sqrt((startX - centerX) ** 2 + (startY - centerY) ** 2);
                            const tailMax = Math.sqrt((endX - centerX) ** 2 + (endY - centerY) ** 2);
                            let tailRadii;
                            if (maxTailInf !== minTailInf) {
                                tailRadii = yearsList.map((year, i) => {
                                    const val = influenceByYear[year];
                                    return tailMin + ((val - minTailInf) / (maxTailInf - minTailInf)) * (tailMax - tailMin);
                                });
                            } else {
                                // All years unknown: interpolate from start to end
                                tailRadii = yearsList.map((year, i) => {
                                    const t = i / (yearsList.length - 1);
                                    return tailMin + t * (tailMax - tailMin);
                                });
                            }
                            // Interpolate angles from startAngle to endAngle
                            const angles = yearsList.map((year, i) => {
                                const t = i / (yearsList.length - 1);
                                return startAngle + t * (endAngle - startAngle);
                            });
                            // Build tail path
                            const minW = 0.8; // Thinner tip
                            const maxW = artistRadius * 1.8; // Thicker end
                            const pointsOuter = [];
                            const pointsInner = [];
                            for (let i = 0; i < angles.length; ++i) {
                                const t = i / (angles.length - 1);
                                const a = angles[i];
                                // Use a curve that starts thin and gets thicker (quadratic or cubic)
                                const widthCurve = t * t; // Quadratic curve for smooth thickening
                                const w = minW + (maxW - minW) * widthCurve;
                                const rOuter = tailRadii[i] + w / 2;
                                const rInner = tailRadii[i] - w / 2;
                                pointsOuter.push([
                                    centerX + Math.cos(a) * rOuter,
                                    centerY + Math.sin(a) * rOuter
                                ]);
                                pointsInner.push([
                                    centerX + Math.cos(a) * rInner,
                                    centerY + Math.sin(a) * rInner
                                ]);
                            }
                            // Build smooth path using quadratic curves
                            if (pointsOuter.length > 0 && !isNaN(pointsOuter[0][0]) && !isNaN(pointsOuter[0][1])) {
                                let d = `M${pointsOuter[0][0]},${pointsOuter[0][1]}`;
                                for (let i = 1; i < pointsOuter.length; ++i) {
                                    const prev = pointsOuter[i - 1];
                                    const curr = pointsOuter[i];
                                    if (!isNaN(prev[0]) && !isNaN(prev[1]) && !isNaN(curr[0]) && !isNaN(curr[1])) {
                                        const midX = (prev[0] + curr[0]) / 2;
                                        const midY = (prev[1] + curr[1]) / 2;
                                        d += ` Q${prev[0]},${prev[1]} ${midX},${midY}`;
                                    }
                                }
                                // Complete the outer path to the last point
                                if (pointsOuter.length > 1) {
                                    const lastPoint = pointsOuter[pointsOuter.length - 1];
                                    if (!isNaN(lastPoint[0]) && !isNaN(lastPoint[1])) {
                                        d += ` L${lastPoint[0]},${lastPoint[1]}`;
                                    }
                                }
                                // Inner path (reverse direction)
                                for (let i = pointsInner.length - 1; i >= 0; --i) {
                                    if (i === pointsInner.length - 1) {
                                        const point = pointsInner[i];
                                        if (!isNaN(point[0]) && !isNaN(point[1])) {
                                            d += ` L${point[0]},${point[1]}`;
                                        }
                                    } else {
                                        const curr = pointsInner[i];
                                        const next = pointsInner[i + 1];
                                        if (!isNaN(curr[0]) && !isNaN(curr[1]) && !isNaN(next[0]) && !isNaN(next[1])) {
                                            const midX = (curr[0] + next[0]) / 2;
                                            const midY = (curr[1] + next[1]) / 2;
                                            d += ` Q${next[0]},${next[1]} ${midX},${midY}`;
                                        }
                                    }
                                }
                                d += 'Z';
                                g.append('path')
                                    .attr('d', d)
                                    .attr('fill', '#ff0')
                                    .attr('opacity', 0.45);
                            }
                        }
                    }
                    // --- Draw tails for all visible artists when any artist is selected ---
                    if (selectedArtistId && Array.isArray(node.contributedTo) && node.contributedTo.length > 1 && selectedArtistId !== node.id) {
                        
                        // 1. Get all contributed years, sorted
                        const yearsContributed = node.contributedTo
                            .map(id => {
                                const art = nodeById[id];
                                return art ? Number(art.release_date) : null;
                            })
                            .filter(y => y !== null)
                            .sort((a, b) => a - b);
                        if (yearsContributed.length > 1) {
                            const firstYear = String(yearsContributed[0]);
                            // Start and end angles
                            const startAngle = arcYears.includes(firstYear) ? angleScale(firstYear) - Math.PI / 2 : artistAngle;
                            // Use the actual angle to the jittered artist position
                            const actualEndAngle = Math.atan2(y - centerY, x - centerX);
                            let endAngle = actualEndAngle;
                            if (endAngle <= startAngle) endAngle += 2 * Math.PI;
                            // Calculate 0.3 * artworkRatio position for all artists
                            let startRadius;
                            if (bandIdx === 0) {
                                // For band 0, start at the artist's radius (same as end)
                                startRadius = finalR;
                            } else {
                                // For other bands, start at the baseline
                                startRadius = minBand + rJitter;
                            }
                            const startX = centerX + Math.cos(startAngle) * startRadius + 0;
                            const startY = centerY + Math.sin(startAngle) * startRadius + 0;
                            const endX = x; // actual artist position (blended)
                            const endY = y;
                            // --- Use node.influence (array: [{year, score}, ...]) ---
                            const influenceArray = Array.isArray(node.influence) ? node.influence : [];
                            // Filter out non-numeric years and handle "Unknown" influence
                            const cleanInfluenceArray = [];
                            let unknownInfluence = 0;
                            influenceArray.forEach(inf => {
                                if (inf.year === "Unknown" || isNaN(Number(inf.year))) {
                                    unknownInfluence += inf.score || 0;
                                } else {
                                    cleanInfluenceArray.push(inf);
                                }
                            });
                            // Distribute unknown influence proportionally across active years
                            if (unknownInfluence > 0 && yearsContributed.length > 0) {
                                const avgInfluencePerYear = unknownInfluence / yearsContributed.length;
                                yearsContributed.forEach(year => {
                                    cleanInfluenceArray.push({
                                        year: String(year),
                                        score: avgInfluencePerYear
                                    });
                                });
                            }
                            // Build yearsList as sorted union of all artwork years and influence years
                            const influenceYears = cleanInfluenceArray.map(inf => String(inf.year));
                            const artworkYears = yearsContributed.map(y => String(y));
                            const yearsSet = new Set([...artworkYears, ...influenceYears]);
                            const yearsList = Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
                            // Build cumulative influence by year with interpolation for unknown years
                            let influenceByYear = {};
                            let cumulative = 0;
                            // First, build a map of year -> cumulative influence for known years
                            const knownYears = yearsList.filter(year => 
                                cleanInfluenceArray.some(inf => String(inf.year) === year)
                            );
                            let lastKnownIdx = -1;
                            let lastKnownValue = 0;
                            let nextKnownIdx = -1;
                            let nextKnownValue = 0;
                            // Precompute cumulative sums for known years
                            let runningSum = 0;
                            const cumulativeByKnownYear = {};
                            yearsList.forEach(year => {
                                const yearInfluences = cleanInfluenceArray.filter(inf => String(inf.year) === year);
                                if (yearInfluences.length > 0) {
                                    const yearScore = yearInfluences.reduce((sum, inf) => sum + (inf.score || 0), 0);
                                    runningSum += yearScore;
                                    cumulativeByKnownYear[year] = runningSum;
                                }
                            });
                            // Now fill influenceByYear with interpolation for unknown years
                            for (let i = 0; i < yearsList.length; ++i) {
                                const year = yearsList[i];
                                if (cumulativeByKnownYear[year] !== undefined) {
                                    cumulative = cumulativeByKnownYear[year];
                                    influenceByYear[year] = cumulative;
                                    lastKnownIdx = i;
                                    lastKnownValue = cumulative;
                                } else {
                                    // Find next known year
                                    if (nextKnownIdx <= i) {
                                        nextKnownIdx = -1;
                                        for (let j = i + 1; j < yearsList.length; ++j) {
                                            if (cumulativeByKnownYear[yearsList[j]] !== undefined) {
                                                nextKnownIdx = j;
                                                nextKnownValue = cumulativeByKnownYear[yearsList[j]];
                                                break;
                                            }
                                        }
                                    }
                                    if (lastKnownIdx === -1 && nextKnownIdx !== -1) {
                                        // Before first known: flat at next known value
                                        influenceByYear[year] = nextKnownValue;
                                    } else if (lastKnownIdx !== -1 && nextKnownIdx === -1) {
                                        // After last known: flat at last known value
                                        influenceByYear[year] = lastKnownValue;
                                    } else if (lastKnownIdx !== -1 && nextKnownIdx !== -1) {
                                        // Interpolate between last known and next known
                                        const t = (i - lastKnownIdx) / (nextKnownIdx - lastKnownIdx);
                                        influenceByYear[year] = lastKnownValue + t * (nextKnownValue - lastKnownValue);
                                    } else {
                                        // No known values at all
                                        influenceByYear[year] = 0;
                                    }
                                }
                            }
                            const influenceVals = Object.values(influenceByYear);
                            const minTailInf = Math.min(...influenceVals);
                            const maxTailInf = Math.max(...influenceVals);
                            // For each year, calculate the tail radius (distance from center)
                            const tailMin = Math.sqrt((startX - centerX) ** 2 + (startY - centerY) ** 2);
                            const tailMax = Math.sqrt((endX - centerX) ** 2 + (endY - centerY) ** 2);
                            let tailRadii;
                            if (maxTailInf !== minTailInf) {
                                tailRadii = yearsList.map((year, i) => {
                                    const val = influenceByYear[year];
                                    return tailMin + ((val - minTailInf) / (maxTailInf - minTailInf)) * (tailMax - tailMin);
                                });
                            } else {
                                // All years unknown: interpolate from start to end
                                tailRadii = yearsList.map((year, i) => {
                                    const t = i / (yearsList.length - 1);
                                    return tailMin + t * (tailMax - tailMin);
                                });
                            }
                            // Interpolate angles from startAngle to endAngle
                            const angles = yearsList.map((year, i) => {
                                const t = i / (yearsList.length - 1);
                                return startAngle + t * (endAngle - startAngle);
                            });
                            // Build tail path
                            const minW = 0.8; // Thinner tip
                            const maxW = artistRadius * 1.8; // Thicker end
                            const pointsOuter = [];
                            const pointsInner = [];
                            for (let i = 0; i < angles.length; ++i) {
                                const t = i / (angles.length - 1);
                                const a = angles[i];
                                // Use a curve that starts thin and gets thicker (quadratic or cubic)
                                const widthCurve = t * t; // Quadratic curve for smooth thickening
                                const w = minW + (maxW - minW) * widthCurve;
                                const rOuter = tailRadii[i] + w / 2;
                                const rInner = tailRadii[i] - w / 2;
                                pointsOuter.push([
                                    centerX + Math.cos(a) * rOuter,
                                    centerY + Math.sin(a) * rOuter
                                ]);
                                pointsInner.push([
                                    centerX + Math.cos(a) * rInner,
                                    centerY + Math.sin(a) * rInner
                                ]);
                            }
                            // Build smooth path using quadratic curves
                            if (pointsOuter.length > 0 && !isNaN(pointsOuter[0][0]) && !isNaN(pointsOuter[0][1])) {
                                let d = `M${pointsOuter[0][0]},${pointsOuter[0][1]}`;
                                for (let i = 1; i < pointsOuter.length; ++i) {
                                    const prev = pointsOuter[i - 1];
                                    const curr = pointsOuter[i];
                                    if (!isNaN(prev[0]) && !isNaN(prev[1]) && !isNaN(curr[0]) && !isNaN(curr[1])) {
                                        const midX = (prev[0] + curr[0]) / 2;
                                        const midY = (prev[1] + curr[1]) / 2;
                                        d += ` Q${prev[0]},${prev[1]} ${midX},${midY}`;
                                    }
                                }
                                // Complete the outer path to the last point
                                if (pointsOuter.length > 1) {
                                    const lastPoint = pointsOuter[pointsOuter.length - 1];
                                    if (!isNaN(lastPoint[0]) && !isNaN(lastPoint[1])) {
                                        d += ` L${lastPoint[0]},${lastPoint[1]}`;
                                    }
                                }
                                // Inner path (reverse direction)
                                for (let i = pointsInner.length - 1; i >= 0; --i) {
                                    if (i === pointsInner.length - 1) {
                                        const point = pointsInner[i];
                                        if (!isNaN(point[0]) && !isNaN(point[1])) {
                                            d += ` L${point[0]},${point[1]}`;
                                        }
                                    } else {
                                        const curr = pointsInner[i];
                                        const next = pointsInner[i + 1];
                                        if (!isNaN(curr[0]) && !isNaN(curr[1]) && !isNaN(next[0]) && !isNaN(next[1])) {
                                            const midX = (curr[0] + next[0]) / 2;
                                            const midY = (curr[1] + next[1]) / 2;
                                            d += ` Q${next[0]},${next[1]} ${midX},${midY}`;
                                        }
                                    }
                                }
                                d += 'Z';
                                g.append('path')
                                    .attr('d', d)
                                    .attr('fill', '#888')
                                    .attr('opacity', 0.3);
                            }
                        }
                    }
                    // --- Draw artist node (copied from previous logic) ---
                    if (node._type === 'person') {
                        const isContributorToInfluence = selectedArtistId && contributorIds.has(node.id);
                        const influenceColor = isContributorToInfluence ? '#0ff' : fillColor;
                        g.append('circle')
                            .attr('cx', x)
                            .attr('cy', y)
                            .attr('r', artistRadius)
                            .attr('fill', influenceColor)
                            .attr('stroke', stroke)
                            .attr('stroke-width', strokeWidth)
                            .attr('opacity', opacity)
                            .style('cursor', 'pointer')
                            .on('mousemove', (event) => {
                                const isSailor = node.name && node.name.toLowerCase().includes('sailor');
                               
                                tooltip
                                    .style('display', 'block')
                                    .html(
                                        `<b>${node.name || node.id}</b><br/>Person<br/>Visible Artworks: ${numArtworks}<br/>Total Artworks: ${totalArtworksAll}` +
                                        (Array.isArray(node.roles) && node.roles.length
                                            ? `<br/>Roles: ${node.roles.join(', ')}`
                                            : '') 
                                        
                                    )                                    
                                    .style('left', (event.pageX + 12) + 'px')
                                    .style('top', (event.pageY - 24) + 'px');
                            })
                            .on('mouseleave', () => tooltip.style('display', 'none'))
                            .on('click', (event) => {
                                event.stopPropagation();
                                // Always set the selected artist for normal behavior
                                setSelectedArtistId(selectedArtistId === node.id ? null : node.id);
                                // If this is Sailor, also open lightbox
                                if (node.name && node.name.toLowerCase().includes('sailor')) {
                                    setIsLightboxOpen(true);
                                    setLightboxUrl('https://bucolic-pastelito-a132e1.netlify.app/');
                                }
                            });
                    } else {
                        g.append('rect')
                            .attr('x', x - artistRadius)
                            .attr('y', y - artistRadius)
                            .attr('width', artistRadius * 2)
                            .attr('height', artistRadius * 2)
                            .attr('fill', fillColor)
                            .attr('stroke', stroke)
                            .attr('stroke-width', strokeWidth)
                            .attr('opacity', opacity)
                            .style('cursor', 'pointer')
                            .on('mousemove', (event) => {
                                const isSailor = node.name && node.name.toLowerCase().includes('sailor');
                                const sailorNote = isSailor ? '<br/><i style="color: #ffd700;">Click to open website panel</i>' : '';
                                tooltip
                                    .style('display', 'block')
                                    .html(
                                        `<b>${node.name || node.id}</b><br/>Musical Group<br/>Visible Artworks: ${numArtworks}<br/>Total Artworks: ${totalArtworksAll}` +
                                        (Array.isArray(node.roles) && node.roles.length
                                            ? `<br/>Roles: ${node.roles.join(', ')}`
                                            : '') +
                                        sailorNote
                                    ) 
                                    .style('left', (event.pageX + 12) + 'px')
                                    .style('top', (event.pageY - 24) + 'px');
                            })
                            .on('mouseleave', () => tooltip.style('display', 'none'))
                            .on('click', (event) => {
                                event.stopPropagation();
                                // Always set the selected artist for normal behavior
                                setSelectedArtistId(selectedArtistId === node.id ? null : node.id);
                                // If this is Sailor, also open lightbox
                                if (node.name && node.name.toLowerCase().includes('sailor')) {
                                    setIsLightboxOpen(true);
                                    setLightboxUrl('https://bucolic-pastelito-a132e1.netlify.app/');
                                }
                            });
                    }
                });
            });
        }
        // --- Update contribTypes to include record label links ---
        const contribTypes = [
            { key: "performedBy", color: "#FFB547", width: 0.5, dash: "" },
            { key: "composedBy", color: "#DF41FF", width: 0.5, dash: "4,2" },
            { key: "producedBy", color: "#50DAF1", width: 0.5, dash: "2,2" },
            { key: "lyricsBy", color: "#FF5053", width: 0.5, dash: "6,2" },
            { key: "recordedBy", color: "#437BFF", width: 0.5, dash: "1,2" },
            { key: "distributedBy", color: "#D71573", width: 0.5, dash: "3,2" }
        ];

        // --- When drawing links for selected artwork, include record label links ---
        if (selectedArtworkId && artworkPositions[selectedArtworkId]) {
            const artworkNode = nodeById[selectedArtworkId];
            if (artworkNode) {
                const artistRoleMap = new Map();
                contribTypes.forEach(({ key, color, width, dash }) => {
                    if (Array.isArray(artworkNode[key])) {
                        artworkNode[key].forEach(personId => {
                            if (!artistRoleMap.has(personId)) {
                                artistRoleMap.set(personId, []);
                            }
                            artistRoleMap.get(personId).push({ key, color, width, dash });
                        });
                    }
                });
                artistRoleMap.forEach((roles, personId) => {
                    if (artistPositions[personId]) {
                        const from = artworkPositions[selectedArtworkId];
                        const to = artistPositions[personId];
                        const dx = to.x - from.x;
                        const dy = to.y - from.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const controlDistance = Math.min(distance * 0.3, 100); // 30% of distance, max 100px
                        const curveDirection = from.x > to.x ? -1 : 1;
                        const midX = (from.x + to.x) / 2;
                        const midY = (from.y + to.y) / 2 - controlDistance * curveDirection;
                        const contributor = artistNodes.find(n => n.id === personId) || visibleLabels.find(l => l.id === personId);
                        const { color, width, dash } = roles[0];
                        // Dimming logic: if hovering over an artwork, only highlight links connected to it

                        let opacity = 0.85;
                        if (highlightSet) {
                            // Only highlight if either endpoint is in highlightSet (hovering below timeline)
                            if (!highlightSet.has(String(selectedArtworkId)) && !highlightSet.has(String(personId))) {
                                opacity = 0.1;
                            } else {
                                opacity = 1.0;
                            }
                        }
                        g.append('path')
                            .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                            .attr('stroke', color)
                            .attr('stroke-width', width)
                            .attr('fill', 'none')
                            // .attr('stroke-dasharray', dash)
                            .attr('opacity', opacity)
                            .style('cursor', 'pointer')
                            .on('mousemove', (event) => {
                                tooltip
                                    .style('display', 'block')
                                    .html(
                                        `<b>${contributor?.name || personId}</b><br/>Role(s): ${roles.map(r => r.key.replace('By', '')).join(', ')} `
                                    )
                                    .style('left', (event.pageX + 12) + 'px')
                                    .style('top', (event.pageY - 24) + 'px');
                            })
                            .on('mouseleave', () => tooltip.style('display', 'none'));
                    }
                });
                // Record label links
                ['recordedBy', 'distributedBy'].forEach(labelKey => {
                    if (Array.isArray(artworkNode[labelKey])) {
                        artworkNode[labelKey].forEach(labelId => {
                            if (artistPositions[labelId]) {
                                const from = artworkPositions[selectedArtworkId];
                                const to = artistPositions[labelId];
                                const midX = (from.x + to.x) / 2;
                                const midY = (from.y + to.y) / 2 - 80;
                                let color;
                                if (Array.isArray(artworkNode.recordedBy) && Array.isArray(artworkNode.distributedBy) &&
                                    artworkNode.recordedBy.includes(labelId) && artworkNode.distributedBy.includes(labelId)) {
                                    color = "#C369E9"; // both roles
                                } else if (labelKey === 'recordedBy') {
                                    color = "#437BFF";
                                } else if (labelKey === 'distributedBy') {
                                    color = "#D71573";
                                }
                                let dash = labelKey === 'recordedBy' ? "1,2" : "3,2";
                                const labelNode = nodeById[labelId];
                                // Dimming logic: if hovering over an artwork, only highlight links connected to it
                                let opacity = 0.85;
                                if (highlightSet) {
                                    // Only highlight if either endpoint is in highlightSet (hovering below timeline)
                                    if (!highlightSet.has(String(selectedArtworkId)) && !highlightSet.has(String(labelId))) {
                                        opacity = 0.1;
                                    } else {
                                        opacity = 1.0;
                                    }
                                }
                                g.append('path')
                                    .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                                    .attr('stroke', color)
                                    .attr('stroke-width', 0.5)
                                    .attr('fill', 'none')
                                    // .attr('stroke-dasharray', dash)
                                    .attr('opacity', opacity)
                                    .style('cursor', 'pointer')
                                    .on('mousemove', (event) => {
                                        tooltip
                                            .style('display', 'block')
                                            .html(
                                                `<b>${labelNode?.name || labelId}</b><br/>Role(s): ${labelKey.replace('By', '')}`
                                            )
                                            .style('left', (event.pageX + 12) + 'px')
                                            .style('top', (event.pageY - 24) + 'px');
                                    })
                                    .on('mouseleave', () => tooltip.style('display', 'none'));
                            }
                        });
                    }
                });
            }
        }
        // --- Draw links if an artist is selected ---
        if (selectedArtistId && artistPositions[selectedArtistId]) {
            const artistNode = artistNodes.find(n => n.id === selectedArtistId);
            if (artistNode && Array.isArray(artistNode.contributedTo)) {
                artistNode.contributedTo.forEach(artworkId => {
                    if (artworkPositions[artworkId]) {
                        const artworkNode = nodeById[artworkId];
                        if (artworkNode) {
                            // Collect all roles for each artist for this artwork
                            const artistRoleMap = new Map();
                            contribTypes.forEach(({ key, color, width, dash }) => {
                                if (Array.isArray(artworkNode[key])) {
                                    artworkNode[key].forEach(contribId => {
                                        if (!artistRoleMap.has(contribId)) {
                                            artistRoleMap.set(contribId, []);
                                        }
                                        artistRoleMap.get(contribId).push({ key, color, width, dash });
                                    });
                                }
                            });
                            artistRoleMap.forEach((roles, contribId) => {
                                if (artistPositions[contribId]) {
                                    const contributor = artistNodes.find(n => n.id === contribId);
                                    const from = artworkPositions[artworkId];
                                    const to = artistPositions[contribId];
                                    const midX = (from.x + to.x) / 2;
                                    const midY = (from.y + to.y) / 2 - 80;
                                    const { color, width, dash } = roles[0];
                                    // Dimming logic: if hovering over an artwork, only highlight links connected to it
                                    let opacity = 0.6;
                                    if (hoveredArtworkId) {
                                        if (artworkId === hoveredArtworkId || contribId === hoveredArtworkId) {
                                            opacity = 1.0;
                                        } else {
                                            opacity = 0.1;
                                        }
                                    }
                                    g.append('path')
                                        .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                                        .attr('stroke', color)
                                        .attr('stroke-width', width)
                                        .attr('fill', 'none')
                                        // .attr('stroke-dasharray', dash)
                                        .attr('opacity', opacity)
                                        .style('cursor', 'pointer')
                                        .on('mousemove', (event) => {
                                            tooltip
                                                .style('display', 'block')
                                                .html(
                                                    `<b>${contributor?.name || contribId}</b><br/>Role(s): ${roles.map(r => r.key.replace('By', '')).join(', ')}`
                                                )
                                                .style('left', (event.pageX + 12) + 'px')
                                                .style('top', (event.pageY - 24) + 'px');
                                        })
                                        .on('mouseleave', () => tooltip.style('display', 'none'));
                                }
                            });
                            // Record label links
                            ['recordedBy', 'distributedBy'].forEach(labelKey => {
                                if (Array.isArray(artworkNode[labelKey])) {
                                    artworkNode[labelKey].forEach(labelId => {
                                        if (artistPositions[labelId]) {
                                            const from = artworkPositions[artworkId];
                                            const to = artistPositions[labelId];
                                            const midX = (from.x + to.x) / 2;
                                            const midY = (from.y + to.y) / 2 - 80;
                                            let color;
                                            if (Array.isArray(artworkNode.recordedBy) && Array.isArray(artworkNode.distributedBy) &&
                                                artworkNode.recordedBy.includes(labelId) && artworkNode.distributedBy.includes(labelId)) {
                                                color = "#C369E9"; // both roles
                                            } else if (labelKey === 'recordedBy') {
                                                color = "#437BFF";
                                            } else if (labelKey === 'distributedBy') {
                                                color = "#D71573";
                                            }
                                            // let color = labelKey === 'recordedBy' ? "#08f" : "#f80";
                                            let dash = labelKey === 'recordedBy' ? "1,2" : "3,2";
                                            const labelNode = nodeById[labelId];
                                            // Dimming logic: if hovering over an artwork, only highlight links connected to it

                                            let opacity = 0.85;
                                            if (highlightSet) {
                                                // Only highlight if either endpoint is in highlightSet (hovering below timeline)
                                                if (!highlightSet.has(String(selectedArtworkId)) && !highlightSet.has(String(labelId))) {
                                                    opacity = 0.1;
                                                } else {
                                                    opacity = 1.0;
                                                }
                                            }
                                            g.append('path')
                                                .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                                                .attr('stroke', color)
                                                .attr('stroke-width', 0.5)
                                                .attr('fill', 'none')
                                                // .attr('stroke-dasharray', dash)
                                                .attr('opacity', opacity)
                                                .style('cursor', 'pointer')
                                                .on('mousemove', (event) => {
                                                    tooltip
                                                        .style('display', 'block')
                                                        .html(
                                                            `<b>${labelNode?.name || labelId}</b><br/>Role(s): ${labelKey.replace('By', '')}`
                                                        )
                                                        .style('left', (event.pageX + 12) + 'px')
                                                        .style('top', (event.pageY - 24) + 'px');
                                                })
                                                .on('mouseleave', () => tooltip.style('display', 'none'));
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }


        // --- Draw influenced artworks on the timeline when an artist is selected ---
        if (selectedArtistId) {
            const selectedArtist = [...people, ...groups].find(n => n.id === selectedArtistId);
            if (selectedArtist && Array.isArray(selectedArtist.contributedTo)) {
                // Collect all influenced and influencing artworks
                const contributedArtworks = selectedArtist.contributedTo.map(id => nodeById[id]).filter(Boolean);
                const influencedSet = new Set();
                const influencingSet = new Set();
                contributedArtworks.forEach(artwork => {
                    if (Array.isArray(artwork.influenced)) {
                        artwork.influenced.forEach(id => influencedSet.add(String(id)));
                    }
                    if (Array.isArray(artwork.influencedBy)) {
                        artwork.influencedBy.forEach(id => influencingSet.add(String(id)));
                    }
                });
                contributedArtworks.forEach(artwork => {
                    influencedSet.delete(String(artwork.id));
                    influencingSet.delete(String(artwork.id));
                });
                const influencedArtworks = Array.from(influencedSet).map(id => nodeById[id]).filter(Boolean);
                const influencingArtworks = Array.from(influencingSet).map(id => nodeById[id]).filter(Boolean);

                // Collect all contributors to influencing/influenced artworks

                if (selectedArtistId) {
                [...influencedArtworks, ...influencingArtworks].forEach(artwork => {
                    ['performedBy', 'composedBy', 'producedBy', 'lyricsBy'].forEach(role => {
                    if (Array.isArray(artwork[role])) {
                        artwork[role].forEach(id => contributorIds.add(id));
                    }
                    });
                });
                }
                // --- Dimming/highlighting logic for hover ---
                let highlightSet = new Set();
                if (hoveredArtworkId && nodeById[hoveredArtworkId]) {
                    const hovered = nodeById[hoveredArtworkId];
                    if (Array.isArray(hovered.influenced)) hovered.influenced.forEach(id => highlightSet.add(String(id)));
                    if (Array.isArray(hovered.influencedBy)) hovered.influencedBy.forEach(id => highlightSet.add(String(id)));
                    highlightSet.add(String(hoveredArtworkId));
                }

                // --- Dot size logic (copied from above-the-timeline) ---
                const personFilterActive = selectedArtistId !== null;
                const filterActivePart =
                    (selectedGenres.size < 10 && selectedGenres.size > 0) ||
                    (influenceGenres.size > 0 && selectedGenres.size < 10) ||
                    (influenceGenres.size < 3 && influenceGenres.size > 0) ||
                    selectedLabelId !== null;
                    const genreGlobalIndex = {};
                    genres.forEach((g, i) => { genreGlobalIndex[g] = i; });
                // --- Draw combined influenced/influencing artworks below the timeline ---
                arcYears.forEach(year => {
                    GENRE_GROUPS.forEach((group, groupIdx) => {
                        group.genres.forEach((genre, genreIdx) => {
                            // Get all unique artworks for this year/genre
                            const yearInfluencing = influencingArtworks.filter(d => String(d.release_date) === String(year) && d.genre === genre);
                            const yearInfluenced = influencedArtworks.filter(d => String(d.release_date) === String(year) && d.genre === genre);
                            
                            // Create a map to track unique artworks and their roles
                            const artworkMap = new Map();
                            
                            // Add influencing artworks
                            yearInfluencing.forEach(artwork => {
                                if (!artworkMap.has(artwork.id)) {
                                    artworkMap.set(artwork.id, { artwork, isInfluencing: true, isInfluenced: false });
                                } else {
                                    artworkMap.get(artwork.id).isInfluencing = true;
                                }
                            });
                            
                            // Add influenced artworks
                            yearInfluenced.forEach(artwork => {
                                if (!artworkMap.has(artwork.id)) {
                                    artworkMap.set(artwork.id, { artwork, isInfluencing: false, isInfluenced: true });
                                } else {
                                    artworkMap.get(artwork.id).isInfluenced = true;
                                }
                            });

                            // Positioning logic
                            const angle = angleScale(year) - Math.PI / 2;
                            const arcBaseX = Math.cos(angle) * radius;
                            const arcBaseY = Math.sin(angle) * radius;
                            const tanX = -Math.sin(angle);
                            const tanY = Math.cos(angle);
                            const groupBaseX = centerX + arcBaseX + Math.cos(angle) * groupOffset;
                            const groupBaseY = centerY + arcBaseY + Math.sin(angle) * groupOffset;
                            const globalIdx = genreGlobalIndex[genre];

                            const offset = (globalIdx - (genres.length - 1) / 2) * (barWidth + barGap)*2;
                            const x = groupBaseX + tanX * offset;
                            const y = groupBaseY + tanY * offset;
                            let stackIdx = 0;
                            
                            // Draw each unique artwork once
                            artworkMap.forEach(({ artwork, isInfluencing, isInfluenced }) => {
                                const isAlbum = artwork["Node Type"].toLowerCase() === 'album';
                                const isNotable = artwork.notable;
                                const baseRadius = isAlbum ? 1.0 : 0.7;
                                const dotRadius = personFilterActive ? baseRadius * 4 : filterActivePart ? baseRadius * 3 : baseRadius;
                                const barAngle = Math.atan2(y - centerY, x - centerX);
                                const r = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) - 10 - (stackIdx * 8);
                                const dotX = centerX + Math.cos(barAngle) * r;
                                const dotY = centerY + Math.sin(barAngle) * r;
                                
                                let opacity = 1.0;
                                if (highlightSet.size > 0 && !highlightSet.has(String(artwork.id))) opacity = 0.1;
                                
                                // Determine border style based on hover state and artwork roles
                                let strokeColor = '#fff';
                                let strokeWidth = 1.2;
                                let strokeDasharray = 'none';
                                
                                if (isInfluencing && isInfluenced) {
                                    // Both roles - use dashed border by default
                                    strokeDasharray = '3,2';
                                    if (hoveredArtworkId && nodeById[hoveredArtworkId]) {
                                        const hovered = nodeById[hoveredArtworkId];
                                        // Check if this artwork influenced the hovered one
                                        if (Array.isArray(hovered.influencedBy) && hovered.influencedBy.includes(artwork.id)) {
                                            strokeColor = '#fff'; // White border when influencing hovered
                                            strokeDasharray = 'none'; // Solid border when directly related
                                        } else if (Array.isArray(artwork.influencedBy) && artwork.influencedBy.includes(hoveredArtworkId)) {
                                            strokeColor = '#000'; // Black border when influenced by hovered
                                            strokeDasharray = 'none'; // Solid border when directly related
                                        } else {
                                            strokeColor = '#888'; // Gray border when no direct relationship
                                            strokeDasharray = '3,2'; // Keep dashed when no direct relationship
                                        }
                                    } else {
                                        strokeColor = '#888'; // Default gray for both roles
                                        strokeDasharray = '3,2'; // Default dashed for both roles
                                    }
                                } else if (isInfluencing) {
                                    strokeColor = '#fff'; // White border for influencing only
                                } else if (isInfluenced) {
                                    strokeColor = '#000'; // Black border for influenced only
                                }
                                
                                // Main dot
                                g.append('circle')
                                    .attr('cx', dotX)
                                    .attr('cy', dotY)
                                    .attr('r', dotRadius)
                                    .attr('fill', genreLookup[genre]?.color || '#fff')
                                    .attr('stroke', strokeColor)
                                    .attr('stroke-width', strokeWidth)
                                    .attr('stroke-dasharray', strokeDasharray)
                                    .attr('opacity', opacity)
                                    .style('cursor', 'pointer')
                                    .on('mousemove', (event) => {
                                        setHoveredArtworkId(artwork.id);
                                        tooltip
                                            .style('display', 'block')
                                            .html(
                                                `<b style="color:${genreLookup[genre]?.color || "#fff"}">${genre}</b><br/>
                                                ${isNotable ? (isAlbum ? "Notable Album" : "Notable Song") : (isAlbum ? "Album" : "Song")}: ${artwork.name || ""}<br/>
                                                ${isInfluencing && isInfluenced ? 'Influencing & Influenced' : isInfluencing ? 'Influencing' : 'Influenced'}`
                                            )
                                            .style('left', (event.pageX + 12) + 'px')
                                            .style('top', (event.pageY - 24) + 'px');
                                    })
                                    .on('mouseleave', () => {
                                        setHoveredArtworkId(null);
                                        tooltip.style('display', 'none');
                                    })
                                    .on('click', (event) => {
                                        event.stopPropagation();
                                        setSelectedArtworkId(artwork.id === selectedArtworkId ? null : artwork.id);
                                    });
                                
                                // Inner circle
                                g.append('circle')
                                    .attr('cx', dotX)
                                    .attr('cy', dotY)
                                    .attr('r', dotRadius * 0.45)
                                    .attr('fill', isNotable ? '#fff' : '#000')
                                    .attr('opacity', opacity)
                                    .style('pointer-events', 'none');
                                
                                stackIdx++;
                            });
                        });
                    });
                });
            }
        }
        // --- Draw influence edges line chart when influence filter is on ---
        if (influenceGenres.size > 0 && influenceGenres.size < genres.length) {
            // Count influence edges by year (where influencedBy genre is in filtered genres)
            const influenceCountsByYear = {};
            arcYears.forEach(year => { influenceCountsByYear[year] = 0; });
            filteredNodes.forEach(node => {
                if (Array.isArray(node.influencedBy)) {
                    node.influencedBy.forEach(infId => {
                        const infNode = nodeById[infId];
                        if (infNode && influenceGenres.has(infNode.genre) && arcYears.includes(String(node.release_date))) {
                            influenceCountsByYear[String(node.release_date)]++;
                        }
                    });
                }
            });
            // Prepare line data
            const lineData = arcYears.map(year => ({
                year,
                count: influenceCountsByYear[year] || 0
            }));
            // Y scale for line (place above bars, extend peaks outwards)
            const maxCount = Math.max(1, ...lineData.map(d => d.count));
            const barBandOuter = radius + groupOffset + 20; // just outside the bars
            const peakExtension = 120; // how far the highest peak extends outwards
            const yScale = d3.scaleLinear()
                .domain([0, maxCount])
                .range([barBandOuter, barBandOuter + peakExtension]);
            // Build line path
            const line = d3.line()
                .x(d => {
                    const angle = angleScale(d.year) - Math.PI / 2;
                    const r = yScale(d.count); // Use the peak radius for x
                    return centerX + Math.cos(angle) * r;
                })
                .y(d => {
                    const angle = angleScale(d.year) - Math.PI / 2;
                    const r = yScale(d.count); // Use the peak radius for y
                    return centerY + Math.sin(angle) * r;
                })
                .curve(d3.curveMonotoneX);
            g.append('path')
                .datum(lineData)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', '#fff') // or use '#bbb' for gray
                .attr('stroke-width', 2.5)
                .attr('opacity', 0.85);
        }
    }, [filteredNodes, years, genres, artistNodes, visibleLabels, selectedGenres, visibleSongAlbumIds, nodeById, selectedArtistId, selectedLabelId, selectedArtworkId, influenceGenres, arcYears, angleScale, svgHeight, hoveredArtworkId]);

    // Debounced draw
    const debouncedDraw = useMemo(() => debounce(draw, 100), [draw, hoveredArtworkId]);

    useEffect(() => {
        if (!ref.current) return;
        debouncedDraw();
        const svgSelection = d3.select(ref.current);
        const zoom = d3.zoom()
            .scaleExtent([0.2, 5])
            .on('zoom', (event) => {
                zoomTransformRef.current = event.transform;
                svgSelection.select('.zoom-group').attr('transform', event.transform);
            });
        svgSelection.call(zoom);
        svgSelection.call(zoom.transform, zoomTransformRef.current);
        let resizeObserver = new window.ResizeObserver(() => {
            debouncedDraw();
        });
        if (ref.current) {
            resizeObserver.observe(ref.current);
        }
        return () => {
            debouncedDraw.cancel && debouncedDraw.cancel();
            resizeObserver.disconnect();
        };
    }, [debouncedDraw, ref, svgHeight]);

    // --- UI ---

    return (
        <div>
            <Lightbox 
                isOpen={isLightboxOpen} 
                onClose={() => setIsLightboxOpen(false)} 
                url={lightboxUrl} 
            />
            <div className="overview" style={{ width: '100%' }}>
                <svg ref={ref} width="100%" height={svgHeight}></svg>
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: '3em',
                    width: '100%',
                    margin: '1em 0 2em 0',
                    fontSize: '0.85em',
                    position: 'absolute',
                    top: "1em",
                    left: 0
                }}
            >

                {/* Artist Role Filter Group */}
                    <div style={{ minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '0.5em' }}>
                            <button
                                onClick={toggleRoleFilter}
                                style={{
                                    marginRight: 8,
                                    background: '#222',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    padding: '2px 8px'
                                }}
                            >
                                {showArtistFilter ? '−' : '+'}
                            </button>
                            <label style={{
                                fontWeight: allRolesSelected ? 'bold' : 'normal',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: '0.85em'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={allRolesSelected}
                                    onChange={handleRoleSelectAll}
                                    style={{ marginRight: 6 }}
                                    ref={el => {
                                        if (el) {
                                            el.indeterminate = !allRolesSelected && !noneRolesSelected;
                                        }
                                    }}
                                />
                                Artist Role: Select All
                            </label>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flexWrap: 'wrap'
                        }}>
                            {showArtistFilter && ARTIST_ROLES.map(roleObj => (
                                <label key={roleObj.label} style={{
                                    fontWeight: selectedRoles.has(roleObj.label) ? 'bold' : 'normal',
                                    color: roleObj.color,
                                    opacity: selectedRoles.size === 0 || selectedRoles.has(roleObj.label) ? 1 : 0.4,
                                    cursor: 'pointer',
                                    marginBottom: 1,
                                    fontSize: '0.85em'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRoles.has(roleObj.label)}
                                        onChange={() => handleRoleChange(roleObj.label)}
                                        style={{ marginRight: 6 }}
                                    />
                                    {roleObj.label}
                                </label>
                            ))}
                        </div>
                    </div>
                {/* Main Genre Filter Group */}
                <div style={{ minWidth: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '0.5em' }}>
                        <button
                            onClick={() => setShowGenreFilter(v => !v)}
                            style={{
                                marginRight: 8,
                                background: '#222',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                padding: '2px 8px'
                            }}
                        >
                            {showGenreFilter ? '−' : '+'}
                        </button>
                        <label style={{
                            fontWeight: allSelected ? 'bold' : 'normal',
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: '0.85em'
                        }}>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={handleSelectAll}
                                style={{ marginRight: 6 }}
                                ref={el => {
                                    if (el) {
                                        el.indeterminate = !allSelected && !noneSelected;
                                    }
                                }}
                            />
                            Genre: Select All
                        </label>
                    </div>
                    {showGenreFilter && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            gap: '1.2em',
                            flexWrap: 'wrap'
                        }}>
                            {GENRE_GROUPS.map((group, groupIdx) => (
                                <div key={group.name} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    margin: '0 0.5em'
                                }}>
                                    <div style={{
                                        fontWeight: 'bold',
                                        color: `hsl(${group.hue},80%,85%)`,
                                        marginBottom: '0.2em',
                                        fontSize: '0.85em'
                                    }}>{group.name}</div>
                                    {group.genres.map((genre, genreIdx) => (
                                        <label key={genre} style={{
                                            fontWeight: selectedGenres.has(genre) ? 'bold' : 'normal',
                                            color: genreLookup[genre]?.color || "#fff",
                                            opacity: selectedGenres.size === 0 || selectedGenres.has(genre) ? 1 : 0.4,
                                            cursor: 'pointer',
                                            marginBottom: 1,
                                            fontSize: '0.85em'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedGenres.has(genre)}
                                                onChange={() => handleGenreChange(genre)}
                                                style={{ marginRight: 6 }}
                                            />
                                            {genre}
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* Influence Filter Group */}
                <div style={{ minWidth: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '0.5em' }}>
                        <button
                            onClick={() => setShowInfluenceFilter(v => !v)}
                            style={{
                                marginRight: 8,
                                background: '#222',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                padding: '2px 8px'
                            }}
                        >
                            {showInfluenceFilter ? '−' : '+'}
                        </button>
                        <label style={{
                            fontWeight: allInfluenceSelected ? 'bold' : 'normal',
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: '0.85em'
                        }}>
                            <input
                                type="checkbox"
                                checked={allInfluenceSelected}
                                onChange={handleInfluenceSelectAll}
                                style={{ marginRight: 6 }}
                                ref={el => {
                                    if (el) {
                                        el.indeterminate = !allInfluenceSelected && !noneInfluenceSelected;
                                    }
                                }}
                            />
                            Influence: Select All
                        </label>
                    </div>
                    {showInfluenceFilter && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            gap: '1.2em',
                            flexWrap: 'wrap'
                        }}>
                            {GENRE_GROUPS.map((group, groupIdx) => (
                                <div key={group.name + "_influence"} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    margin: '0 0.5em'
                                }}>
                                    <div style={{
                                        fontWeight: 'bold',
                                        color: `hsl(${group.hue},80%,85%)`,
                                        marginBottom: '0.2em',
                                        fontSize: '0.85em'
                                    }}>{group.name}</div>
                                    {group.genres.map((genre, genreIdx) => (
                                        <label key={genre + "_influence"} style={{
                                            fontWeight: influenceGenres.has(genre) ? 'bold' : 'normal',
                                            color: genreLookup[genre]?.color || "#fff",
                                            opacity: influenceGenres.size === 0 || influenceGenres.has(genre) ? 1 : 0.4,
                                            cursor: 'pointer',
                                            marginBottom: 1,
                                            fontSize: '0.85em'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={influenceGenres.has(genre)}
                                                onChange={() => handleInfluenceGenreChange(genre)}
                                                style={{ marginRight: 6 }}
                                            />
                                            {genre}
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                                {/* Artist Search Box */}
                <div style={{ minWidth: 220, marginBottom: 12 }}>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={artistSearch}
                            onChange={e => {
                                setArtistSearch(e.target.value);
                                setShowArtistDropdown(true);
                            }}
                            onFocus={() => setShowArtistDropdown(true)}
                            onBlur={() => setTimeout(() => setShowArtistDropdown(false), 150)}
                            placeholder="Search artist..."
                            style={{
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '2px solid #f7f7f7',
                                fontSize: '1em',
                                background: '#fff',
                                color: '#000',
                                outline: 'none',
                            }}
                        />
                        {showArtistDropdown && artistSearch && artistSearchResults.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '110%',
                                left: 0,
                                right: 0,
                                background: '#222',
                                border: '1px solid #444',
                                borderRadius: 4,
                                zIndex: 10,
                                maxHeight: 180,
                                overflowY: 'auto',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}>
                                {artistSearchResults.slice(0, 10).map(a => (
                                    <div
                                        key={a.id}
                                        onMouseDown={e => {
                                            e.preventDefault();
                                            setSelectedArtistId(a.id);
                                            setArtistSearch("");
                                            setShowArtistDropdown(false);
                                            if (searchInputRef.current) searchInputRef.current.blur();
                                            // If this is Sailor, also open lightbox
                                            if (a.name && a.name.toLowerCase().includes('sailor')) {
                                                setIsLightboxOpen(true);
                                                setLightboxUrl('https://bucolic-pastelito-a132e1.netlify.app/');
                                            }
                                        }}
                                        style={{
                                            padding: '6px 10px',
                                            cursor: 'pointer',
                                            background: selectedArtistId === a.id ? '#444' : 'none',
                                            color: '#fff',
                                            fontWeight: selectedArtistId === a.id ? 'bold' : 'normal',
                                            borderBottom: '1px solid #333',
                                        }}
                                    >
                                        {a.name}
                                        {a._type === 'group' && <span style={{ color: '#aaa', marginLeft: 6 }}>(Group)</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );

}

export default Overview;
