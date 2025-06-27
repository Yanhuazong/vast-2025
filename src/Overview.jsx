import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

// --- Fixed Genre Groups and Colors with more distinct hues ---
const GENRE_GROUPS = [
    {
        name: "Folk",
        hue: 40,
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
        genres: [
            "Indie Pop",
            "Dream Pop",
            "Synthpop"
        ]
    },
    {
        name: "Metal",
        hue: 280,
        genres: [
            "Doom Metal",
            "Speed Metal",
            "Symphonic Metal"
        ]
    },
    {
        name: "Other",
        hue: 120,
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
        group.genres.forEach((genre, genreIdx) => {
            const lightness = 85 - 8 * (genreIdx / Math.max(1, group.genres.length - 1));
            lookup[genre] = {
                group: group.name,
                groupIdx,
                genreIdx,
                color: `hsl(${group.hue},80%,${lightness}%)`
            };
        });
    });
    return lookup;
})();
const FLAT_GENRES = GENRE_GROUPS.flatMap(g => g.genres);

// --- Role filter with link colors ---
const ARTIST_ROLES = [
    { label: "Composer", color: "#f0f" },
    { label: "Lyricist", color: "#0f0" },
    { label: "Performer", color: "#fa0" },
    { label: "Producer", color: "#0ff" }
];

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

// Band height mapping for artist arc band
const bandHeightByYear = [
    { year: 1985, height: 5 },
    { year: 1990, height: 10 },
    { year: 2010, height: 80 },
    { year: 2015, height: 100 },
    { year: 2020, height: 250 },
    { year: 2021, height: 100 },
    { year: 2023, height: 220 },
    { year: 2028, height: 350 },
    { year: 2030, height: 120 },
    { year: 2033, height: 40 },
    { year: 2040, height: 10 }
];
const labelBandHeightByYear = [
    { year: 1985, height: 5 },
    { year: 1990, height: 10 },
    { year: 2010, height: 80 },
    { year: 2015, height: 100 },
    { year: 2020, height: 180 },
    { year: 2021, height: 180 },
    { year: 2023, height: 150 },
    { year: 2028, height: 150 },
    { year: 2030, height: 80 },
    { year: 2033, height: 40 },
    { year: 2040, height: 10 }
];
function Overview({ data }) {

    // Collapsible filter state
    const [showGenreFilter, setShowGenreFilter] = useState(true);
    const [showInfluenceFilter, setShowInfluenceFilter] = useState(true);
    const [showArtistFilter, setShowArtistFilter] = useState(true);
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

    const ref = useRef();

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
            const label = data.nodes.find(n => n.id === selectedLabelId);
            if (label) {
                const recorded = Array.isArray(label.recordedArtwork) ? label.recordedArtwork : [];
                const distributed = Array.isArray(label.distributedArtwork) ? label.distributedArtwork : [];
                const labelSet = new Set([...recorded, ...distributed]);
                filtered = filtered.filter(n => labelSet.has(n.id));
            }
        } else if (selectedArtistId) {
            const artist = data.nodes.find(n => n.id === selectedArtistId);
            if (artist && Array.isArray(artist.contributedTo)) {
                const contributedSet = new Set(artist.contributedTo);
                filtered = filtered.filter(n => contributedSet.has(n.id));
            }
        }
        return filtered;
    }, [nodes, selectedGenres, influenceGenres, data.nodes, selectedArtistId, selectedLabelId]);

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

    useEffect(() => {
        if (!ref.current) return;

        let animationFrame;
        function draw() {
            d3.select(ref.current).selectAll('*').remove();

            const width = ref.current.clientWidth;
            if (!width || width < 100) return;

            const height = 2000;
            const radius = 1500;
            const arcStart = -Math.PI / 4;
            const arcEnd = Math.PI / 4;
            const arcAngle = Math.abs(arcEnd - arcStart);
            const centerX = width / 2;
            const arcMidY = height * 1.5;
            const centerY = arcMidY - radius * Math.cos(arcAngle / 2);
            const zoomArcMidY = height * 0.2;
            const svg = d3.select(ref.current);

            // --- ZOOM LOGIC ---
            const filteredYears = Array.from(new Set(filteredNodes.map(n => n.release_date))).sort();
            const filterActive = (selectedGenres.size !== genres.length || influenceGenres.size > 0 || selectedArtistId || selectedLabelId);
            const arcYears = years;
            const angleScale = d3.scalePoint()
                .domain(arcYears)
                .range([arcStart, arcEnd]);

            let zoomTransform = d3.zoomIdentity;
            if (filterActive && filteredYears.length > 1 && filteredYears.length < arcYears.length - 5) {
                const firstAngle = angleScale(filteredYears[0]) - Math.PI / 2;
                const lastAngle = angleScale(filteredYears[filteredYears.length - 1]) - Math.PI / 2;
                const midAngle = (firstAngle + lastAngle) / 2;
                const midX = centerX + Math.cos(midAngle) * radius;
                const midY = centerY + Math.sin(midAngle) * radius;
                const x1 = centerX + Math.cos(firstAngle) * radius;
                const y1 = centerY + Math.sin(firstAngle) * radius;
                const x2 = centerX + Math.cos(lastAngle) * radius;
                const y2 = centerY + Math.sin(lastAngle) * radius;
                const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                const desiredSpan = width * 0.6;
                const maxScale = 1.5;
                const scale = Math.min(desiredSpan / dist, maxScale);
                zoomTransform = d3.zoomIdentity
                    .translate(centerX, zoomArcMidY)
                    .scale(scale)
                    .translate(-midX, -midY);
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
            const maxBarWidth = 2.5;
            const yearRange = Math.max(arcYears.length, 1);
            const barWidth = Math.max(minBarWidth, Math.min(maxBarWidth, 3 - (yearRange - 2) * 0.04));
            const barGap = 1;
            const groupOffset = 40;

            const tooltip = createTooltip();

            // Draw arc and ticks/labels (always)
            const arc = d3.arc()
                .innerRadius(radius - 20)
                .outerRadius(radius)
                .startAngle(arcStart)
                .endAngle(arcEnd);

            g.append('path')
                .attr('d', arc)
                .attr('fill', '#222')
                .attr('transform', `translate(${centerX},${centerY})`);

            arcYears.forEach(year => {
                const angle = angleScale(year) - Math.PI / 2;
                const tickLength = 20;
                g.append('line')
                    .attr('x1', centerX + Math.cos(angle) * (radius + tickLength + 20))
                    .attr('y1', centerY + Math.sin(angle) * (radius + tickLength + 20))
                    .attr('x2', centerX + Math.cos(angle) * (radius - tickLength))
                    .attr('y2', centerY + Math.sin(angle) * (radius - tickLength))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1.5);
                g.append('text')
                    .attr('x', centerX + Math.cos(angle) * (radius - tickLength - 14))
                    .attr('y', centerY + Math.sin(angle) * (radius - tickLength - 14))
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 14)
                    .attr('alignment-baseline', 'middle')
                    .attr('fill', '#fff')
                    .text(year);
            });

            // --- Store positions for artworks and artists for link drawing ---
            const artworkPositions = {};
            const artistPositions = {};

            // --- PIE CHARTS FOR EACH YEAR (only when influence filter is active) ---
                        const pieMinRadius = 5;
            const pieMaxRadius = 24;
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
                                const infNode = nodes.find(n => n.id === infId);
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
                    const pieArcRadius = radius - 100;
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
                const artworks = visibleArtworks.map(id => nodes.find(n => n.id === id)).filter(Boolean);
                const yearsArr = artworks.map(a => a.release_date).filter(Boolean).sort((a, b) => a - b);
                let medianYear = arcYears[0];
                if (yearsArr.length > 0) {
                    const mid = Math.floor(yearsArr.length / 2);
                    medianYear = yearsArr.length % 2 === 0
                        ? Math.round((Number(yearsArr[mid - 1]) + Number(yearsArr[mid])) / 2)
                        : Number(yearsArr[mid]);
                }
                const yearStr = String(medianYear);
                // Add jitter to angle to reduce overlap
                const baseAngle = arcYears.includes(yearStr) ? angleScale(yearStr) - Math.PI / 2 : angleScale(arcYears[0]) - Math.PI / 2;
                const angleJitter = (Math.random() - 0.5) * 0.09; // ~5 degrees jitter
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
const r = radius + 750 + (Math.random() - 0.5) * bandHeight; // more jitter for more spread

                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;

                // Size
                const totalArtworks = new Set([...recorded, ...distributed]).size;
                const labelRadius = minLabelRadius + (maxLabelArtworks > 1 ? (maxLabelRadius - minLabelRadius) * (totalArtworks - 1) / (maxLabelArtworks - 1) : 0);

                // Color and highlight
                const isSelected = selectedLabelId === label.id;
                const opacity = isSelected ? 1 : 0.7;
                const stroke = isSelected ? '#f80' : '#bfa76f';
                const strokeWidth = isSelected ? 2 : 1;

                // Store position for links
                artistPositions[label.id] = { x, y };

                // Draw label node
                g.append('ellipse')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('rx', labelRadius * 1.3)
                    .attr('ry', labelRadius)
                    .attr('fill', '#ffe0b2')
                    .attr('stroke', stroke)
                    .attr('stroke-width', strokeWidth)
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
                const x1 = groupBaseX + tanX * (-barSpan / 2);
                const y1 = groupBaseY + tanY * (-barSpan / 2);
                const x2 = groupBaseX + tanX * (barSpan / 2);
                const y2 = groupBaseY + tanY * (barSpan / 2);

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
                                    r: 1,
                                    color: genreLookup[genre]?.color || "#fff",
                                    label: "Notable Song"
                                })),
                                ...genreData.filter(d => d["Node Type"].toLowerCase() === 'song' && !d.notable).map(d => ({
                                    ...d,
                                    r: 1,
                                    color: genreLookup[genre]?.color || "#fff",
                                    label: "Song"
                                })),
                                ...genreData.filter(d => d["Node Type"].toLowerCase() === 'album' && d.notable).map(d => ({
                                    ...d,
                                    r: 1.5,
                                    color: genreLookup[genre]?.color || "#fff",
                                    label: "Notable Album"
                                })),
                                ...genreData.filter(d => d["Node Type"].toLowerCase() === 'album' && !d.notable).map(d => ({
                                    ...d,
                                    r: 1.5,
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
                                const dotRadius = personFilterActive ? dot.r * 6 : filterActivePart ? dot.r * 3 : dot.r;
                                const r = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) + stackOffset + dotRadius;
                                const dotX = centerX + Math.cos(barAngle) * r;
                                const dotY = centerY + Math.sin(barAngle) * r;
                                artworkPositions[dot.id] = { x: dotX, y: dotY };

                                if (dot.label === "Notable Song" || dot.label === "Notable Album") {
                                    g.append('circle')
                                        .attr('cx', dotX)
                                        .attr('cy', dotY)
                                        .attr('r', dotRadius)
                                        .attr('fill', dot.color)
                                        .attr('opacity', opacity)
                                        .on('mousemove', (event) => {
                                            tooltip
                                                .style('display', 'block')
                                                .html(
                                                    `<b style="color:${genreLookup[genre]?.color || "#fff"}">${genre}</b><br/>
                                                    ${dot.label}: ${dot.name || ""}`
                                                )
                                                .style('left', (event.pageX + 12) + 'px')
                                                .style('top', (event.pageY - 24) + 'px');
                                        })
                                        .on('mouseleave', () => tooltip.style('display', 'none'))
                                        .on('click', (event) => {
                                            event.stopPropagation();
                                            setSelectedArtworkId(dot.id === selectedArtworkId ? null : dot.id);
                                        });
                                    g.append('circle')
                                        .attr('cx', dotX)
                                        .attr('cy', dotY)
                                        .attr('r', dotRadius * 0.45)
                                        .attr('fill', '#fff')
                                        .attr('opacity', opacity)
                                        .style('pointer-events', 'none'); // Prevent this small circle from capturing mouse events
                                } else {
                                    g.append('circle')
                                        .attr('cx', dotX)
                                        .attr('cy', dotY)
                                        .attr('r', dotRadius)
                                        .attr('fill', dot.color)
                                        .attr('opacity', opacity)
                                        .on('mousemove', (event) => {
                                            tooltip
                                                .style('display', 'block')
                                                .html(
                                                    `<b style="color:${genreLookup[genre]?.color || "#fff"}">${genre}</b><br/>
                                                    ${dot.label}: ${dot.name || ""}`
                                                )
                                                .style('left', (event.pageX + 12) + 'px')
                                                .style('top', (event.pageY - 24) + 'px');
                                        })
                                        .on('mouseleave', () => tooltip.style('display', 'none'))
                                        .on('click', (event) => {
                                            event.stopPropagation();
                                            setSelectedArtworkId(dot.id === selectedArtworkId ? null : dot.id);
                                        });
                                    g.append('circle')
                                        .attr('cx', dotX)
                                        .attr('cy', dotY)
                                        .attr('r', dotRadius * 0.45)
                                        .attr('fill', '#000')
                                        .attr('opacity', opacity)
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
                const minArtistRadius = 1;
                const maxArtistRadius = 7;
                const bandCenter = radius + 450;

                // Find the max number of artworks contributed by any artist (for scaling)
                const maxArtworks = Math.max(
                    1,
                    ...artistNodes.map(node => {
                        const contributedTo = Array.isArray(node.contributedTo)
                            ? node.contributedTo
                            : [];
                        return contributedTo.length;
                    })
                );

                artistNodes.forEach(node => {
                    // Only show if contributed to visible songs/albums
                    const contributedTo = Array.isArray(node.contributedTo)
                        ? node.contributedTo.filter(id => visibleSongAlbumIds.has(id))
                        : [];
                    if (!contributedTo.length) return;

                    // Use lastPublishedYear for artist position if available
                    const lastYear = String(node.lastPublishedYear);
                    let artistAngle;
                    if (lastYear && arcYears.includes(lastYear)) {
                        artistAngle = angleScale(lastYear) - Math.PI / 2;
                    } else {
                        // fallback: average of their artworks' years
                        const allArtworks = contributedTo.map(id => nodes.find(n => n.id === id)).filter(Boolean);
                        const angles = allArtworks.map(art => {
                            const year = art.release_date;
                            if (!year) return null;
                            if (!arcYears.includes(String(year))) return null;
                            return angleScale(String(year)) - Math.PI / 2;
                        }).filter(a => a !== null);
                        artistAngle = angles.length === 0 ? 0 : angles.reduce((a, b) => a + b, 0) / angles.length;
                    }

                    // Find the main year for this artist (average of their artworks)
                    let mainYear = Number(lastYear);
                    if (!mainYear) {
                        const allArtworks = contributedTo.map(id => nodes.find(n => n.id === id)).filter(Boolean);
                        mainYear = allArtworks.length > 0
                            ? Math.round(allArtworks.reduce((sum, art) => sum + (art.release_date || 0), 0) / allArtworks.length)
                            : arcYears[0];
                    }

                    // Interpolate band height for the artist's main year
                    let bandHeight = bandHeightByYear[0].height;
                    for (let i = 1; i < bandHeightByYear.length; i++) {
                        const prev = bandHeightByYear[i - 1];
                        const next = bandHeightByYear[i];
                        if (mainYear <= next.year) {
                            const t = (mainYear - prev.year) / (next.year - prev.year);
                            bandHeight = prev.height + t * (next.height - prev.height);
                            break;
                        }
                    }
                    if (mainYear > bandHeightByYear[bandHeightByYear.length - 1].year) {
                        bandHeight = bandHeightByYear[bandHeightByYear.length - 1].height;
                    }

                    // Set band center and randomize within bandHeight
                    const minBand = bandHeightByYear.reduce((min, d) => Math.min(min, d.height), Infinity);
                    const maxBand = bandHeightByYear.reduce((max, d) => Math.max(max, d.height), -Infinity);
                    const maxJitter = (maxBand - minBand) * 0.2;
                    const r = bandCenter + (Math.random() - 0.5) * bandHeight + (Math.random() - 0.5) * maxJitter;
                    const angle = artistAngle + (Math.random() - 0.5) * 0.05;
                    const x = centerX + Math.cos(angle) * r;
                    const y = centerY + Math.sin(angle) * r;
                    artistPositions[node.id] = { x, y };

                    // Color logic: Sailor is gold, all others light yellow
                    const isSailor = (node.name || '').toLowerCase().includes('sailor');
                    let fillColor = '#fffde7';
                    let artistOpacity = 0.70;
                    // If an artist is selected, highlight all connected artists
                    if (selectedArtistId && Array.isArray(node.contributedTo) && node.contributedTo.length > 0) {
                        // Get all artworks the selected artist contributed to
                        const selectedArtist = artistNodes.find(n => n.id === selectedArtistId);
                        const selectedArtworks = selectedArtist && Array.isArray(selectedArtist.contributedTo)
                            ? selectedArtist.contributedTo
                            : [];

                        // Gather all contributors to those artworks (including the selected artist)
                        let connectedLinkTypes = new Set();
                        let isConnected = false;
                        selectedArtworks.forEach(artworkId => {
                            const artworkNode = nodes.find(n => n.id === artworkId);
                            if (artworkNode) {
                                [
                                    { key: "performedBy", color: "#0ff" },
                                    { key: "composedBy", color: "#f0f" },
                                    { key: "producedBy", color: "#fa0" },
                                    { key: "lyricsBy", color: "#0f0" }
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

                    // Artist size depends on total number of artworks contributed (not just visible)
                    const totalArtworks = Array.isArray(node.contributedTo) ? node.contributedTo.length : 0;
                    const artistRadius = minArtistRadius + (maxArtworks > 1 ? (maxArtistRadius - minArtistRadius) * (totalArtworks - 1) / (maxArtworks - 1) : 0);
                    const numArtworks = contributedTo.length;
                    
                    const isSelected = selectedArtistId === node.id;
                    const opacity = isSelected ? 1 : artistOpacity;
                    const stroke = isSelected ? '#ff0' : 'none';
                    const strokeWidth = isSelected ? 2 : 0.7;

                    // --- Draw variable-width arc tail for selected artist ---
                    if (selectedArtistId === node.id && Array.isArray(node.contributedTo) && node.contributedTo.length > 1) {
                        const yearsContributed = node.contributedTo
                            .map(id => {
                                const art = nodes.find(n => n.id === id);
                                return art ? Number(art.release_date) : null;
                            })
                            .filter(y => y !== null)
                            .sort((a, b) => a - b);

                        if (yearsContributed.length > 1) {
                            const firstYear = String(yearsContributed[0]);
                            if (arcYears.includes(firstYear)) {
                                const startAngle = angleScale(firstYear) - Math.PI / 2;
                                let endAngle = angle;
                                if (endAngle <= startAngle) endAngle += 2 * Math.PI;
                                const tailRadius = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

                                // Tail width settings
                                const minW = 1.2;
                                const maxW = artistRadius * 1.4;
                                const steps = 40;
                                const pointsOuter = [];
                                const pointsInner = [];
                                for (let i = 0; i <= steps; ++i) {
                                    const t = i / steps;
                                    const a = startAngle + (endAngle - startAngle) * t;
                                    const w = minW + (maxW - minW) * t;
                                    const rOuter = tailRadius + w / 2;
                                    const rInner = tailRadius - w / 2;
                                    pointsOuter.push([
                                        centerX + Math.cos(a) * rOuter,
                                        centerY + Math.sin(a) * rOuter
                                    ]);
                                    pointsInner.push([
                                        centerX + Math.cos(a) * rInner,
                                        centerY + Math.sin(a) * rInner
                                    ]);
                                }
                                // Build path: outer arc, then inner arc reversed
                                let d = `M${pointsOuter[0][0]},${pointsOuter[0][1]}`;
                                for (let i = 1; i < pointsOuter.length; ++i) {
                                    d += `L${pointsOuter[i][0]},${pointsOuter[i][1]}`;
                                }
                                for (let i = pointsInner.length - 1; i >= 0; --i) {
                                    d += `L${pointsInner[i][0]},${pointsInner[i][1]}`;
                                }
                                d += 'Z';

                                g.append('path')
                                    .attr('d', d)
                                    .attr('fill', '#ff0')
                                    .attr('opacity', 0.45);
                            }
                        }
                    }

                    if (node._type === 'person') {
                        g.append('circle')
                            .attr('cx', x)
                            .attr('cy', y)
                            .attr('r', artistRadius)
                            .attr('fill', fillColor)
                            .attr('stroke', stroke)
                            .attr('stroke-width', strokeWidth)
                            .attr('opacity', opacity)
                            .style('cursor', 'pointer')
                            .on('mousemove', (event) => {
                                tooltip
                                    .style('display', 'block')
                                    .html(`<b>${node.name || node.id}</b><br/>Person<br/>Visible Artworks: ${numArtworks}<br/>Total Artworks: ${totalArtworks}`)
                                    .style('left', (event.pageX + 12) + 'px')
                                    .style('top', (event.pageY - 24) + 'px');
                            })
                            .on('mouseleave', () => tooltip.style('display', 'none'))
                            .on('click', (event) => {
                                event.stopPropagation();
                                setSelectedArtistId(selectedArtistId === node.id ? null : node.id);
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
                                tooltip
                                    .style('display', 'block')
                                    .html(`<b>${node.name || node.id}</b><br/>Music Group<br/>Visible Artworks: ${numArtworks}<br/>Total Artworks: ${totalArtworks}`)
                                    .style('left', (event.pageX + 12) + 'px')
                                    .style('top', (event.pageY - 24) + 'px');
                            })
                            .on('mouseleave', () => tooltip.style('display', 'none'))
                            .on('click', (event) => {
                                event.stopPropagation();
                                setSelectedArtistId(selectedArtistId === node.id ? null : node.id);
                            });
                    }
                });
            }
            // --- Update contribTypes to include record label links ---
            const contribTypes = [
                { key: "performedBy", color: "#fa0", width: 0.5, dash: "" },
                { key: "composedBy", color: "#f0f", width: 0.5, dash: "4,2" },
                { key: "producedBy", color: "#0ff", width: 0.5, dash: "2,2" },
                { key: "lyricsBy", color: "#0f0", width: 0.5, dash: "6,2" },
                { key: "recordedBy", color: "#08f", width: 0.5, dash: "1,2" },
                { key: "distributedBy", color: "#f80", width: 0.5, dash: "3,2" }
            ];

            // --- When drawing links for selected artwork, include record label links ---
            if (selectedArtworkId && artworkPositions[selectedArtworkId]) {
                const artworkNode = nodes.find(n => n.id === selectedArtworkId);
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
                            const midX = (from.x + to.x) / 2;
                            const midY = (from.y + to.y) / 2 - 80;
                            const contributor = artistNodes.find(n => n.id === personId) || visibleLabels.find(l => l.id === personId);
                            const { color, width, dash } = roles[0];
                            g.append('path')
                                .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                                .attr('stroke', color)
                                .attr('stroke-width', width)
                                .attr('fill', 'none')
                                // .attr('stroke-dasharray', dash)
                                .attr('opacity', 0.85)
                                .style('cursor', 'pointer')
                                .on('mousemove', (event) => {
                                    tooltip
                                        .style('display', 'block')
                                        .html(
                                            `<b>${contributor?.name || personId}</b><br/>Role(s): ${roles.map(r => r.key.replace('By', '')).join(', ')}`
                                        )
                                        .style('left', (event.pageX + 12) + 'px')
                                        .style('top', (event.pageY - 24) + 'px');
                                })
                                .on('mouseleave', () => tooltip.style('display', 'none'));
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
                            const artworkNode = nodes.find(n => n.id === artworkId);
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
                                        g.append('path')
                                            .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                                            .attr('stroke', color)
                                            .attr('stroke-width', width)
                                            .attr('fill', 'none')
                                            // .attr('stroke-dasharray', dash)
                                            .attr('opacity', 0.6)
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
                                ['recordedBy', 'distributedBy'].forEach(labelKey => {
                                    if (Array.isArray(artworkNode[labelKey])) {
                                        artworkNode[labelKey].forEach(labelId => {
                                            if (artistPositions[labelId]) {
                                                const from = artworkPositions[artworkId];
                                                const to = artistPositions[labelId];
                                                const midX = (from.x + to.x) / 2;
                                                const midY = (from.y + to.y) / 2 - 80;
                                                let color = labelKey === 'recordedBy' ? "#08f" : "#f80";
                                                let dash = labelKey === 'recordedBy' ? "1,2" : "3,2";
                                                const labelNode = visibleLabels.find(l => l.id === labelId);
                                                g.append('path')
                                                    .attr('d', `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`)
                                                    .attr('stroke', color)
                                                    .attr('stroke-width', 0.5)
                                                    .attr('fill', 'none')
                                                    // .attr('stroke-dasharray', dash)
                                                    .attr('opacity', 0.85)
                                                    .style('cursor', 'pointer')
                                                    .on('mousemove', (event) => {
                                                        tooltip
                                                            .style('display', 'block')
                                                            .html(
                                                                `<b>${labelNode?.name || labelId}</b><br/>Role: ${labelKey.replace('By', '')}`
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

// --- Draw candlestick base (holder) at the end so it's always visible ---
            const baseY = centerY + radius + 60;
            g.append('ellipse')
                .attr('cx', centerX)
                .attr('cy', baseY + 32)
                .attr('rx', 90)
                .attr('ry', 18)
                .attr('fill', '#bfa76f')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .attr('opacity', 0.97);

            g.append('rect')
                .attr('x', centerX - 18)
                .attr('y', baseY - 80)
                .attr('width', 36)
                .attr('height', 80)
                .attr('rx', 12)
                .attr('fill', '#bfa76f')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .attr('opacity', 0.97);

            g.append('ellipse')
                .attr('cx', centerX)
                .attr('cy', baseY)
                .attr('rx', 70)
                .attr('ry', 16)
                .attr('fill', '#bfa76f')
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.93);
        }

        animationFrame = requestAnimationFrame(draw);

        const svgSelection = d3.select(ref.current);
        const zoom = d3.zoom()
            .scaleExtent([0.2, 5])
            .on('zoom', (event) => {
                svgSelection.select('.zoom-group').attr('transform', event.transform);
            });
        svgSelection.call(zoom);

        let resizeObserver = new window.ResizeObserver(() => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(draw);
        });
        if (ref.current) {
            resizeObserver.observe(ref.current);
        }
        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
        };
    }, [filteredNodes, years, genres, artistNodes, visibleLabels, selectedGenres, visibleSongAlbumIds, nodes, selectedArtistId, selectedLabelId, selectedArtworkId, influenceGenres]);

    // --- UI ---

    return (
        <div>
            <div className="overview" style={{ width: '100%' }}>
                <svg ref={ref} width="100%" height="1000"></svg>
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
                    bottom: 0,
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
            </div>
        </div>
    );

}

export default Overview;