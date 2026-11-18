/** Respuesta 404 para rutas no registradas. */
const notFound = (req, res) => {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
};

module.exports = notFound;
