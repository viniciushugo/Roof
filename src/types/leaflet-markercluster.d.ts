import 'leaflet'

declare module 'leaflet' {
  interface MarkerCluster extends L.Marker {
    getChildCount(): number
  }

  interface MarkerClusterGroupOptions {
    maxClusterRadius?: number
    iconCreateFunction?: (cluster: MarkerCluster) => L.DivIcon
    showCoverageOnHover?: boolean
    spiderfyOnMaxZoom?: boolean
    disableClusteringAtZoom?: number
    chunkedLoading?: boolean
  }

  interface MarkerClusterGroup extends L.FeatureGroup {
    addLayer(layer: L.Layer): this
    removeLayer(layer: L.Layer): this
    clearLayers(): this
    refreshClusters(): this
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup
}
