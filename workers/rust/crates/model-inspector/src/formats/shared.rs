use worker_contracts::{Bounds3, Vector3};

pub fn expand_bounds(bounds: &mut Option<Bounds3>, x: f32, y: f32, z: f32) {
    match bounds {
        Some(current) => {
            current.min.x = current.min.x.min(x);
            current.min.y = current.min.y.min(y);
            current.min.z = current.min.z.min(z);
            current.max.x = current.max.x.max(x);
            current.max.y = current.max.y.max(y);
            current.max.z = current.max.z.max(z);
        }
        None => {
            *bounds = Some(Bounds3 {
                min: Vector3 { x, y, z },
                max: Vector3 { x, y, z },
            });
        }
    }
}
